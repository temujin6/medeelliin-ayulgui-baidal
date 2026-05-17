"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { signJwt } from "@/lib/auth";
import {
  CHALLENGE_COOKIE,
  signChallengeToken,
  verifyChallengeToken,
  webauthnConfig,
} from "@/lib/webauthn";
import {
  createPasskeyUser,
  findPasskeyByCredentialId,
  findUserByEmail,
  insertPasskey,
  listPasskeysForUser,
  parseTransports,
  updatePasskeyCounter,
} from "@/lib/passkey-store";

const EmailSchema = z.email();

const SESSION_COOKIE = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days — matches signJwt expiry

function normalize(email: string): string {
  return EmailSchema.parse(email.trim().toLowerCase());
}

async function setChallengeCookie(
  email: string,
  challenge: string,
  purpose: "register" | "auth",
) {
  const token = await signChallengeToken({ challenge, email, purpose });
  const jar = await cookies();
  jar.set(CHALLENGE_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 5 * 60,
  });
}

async function consumeChallengeCookie(
  email: string,
  purpose: "register" | "auth",
): Promise<string> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE_COOKIE)?.value;
  jar.delete(CHALLENGE_COOKIE);
  if (!token) throw new Error("Challenge not found. Please try again.");

  const payload = await verifyChallengeToken(token);
  if (!payload || payload.email !== email || payload.purpose !== purpose) {
    throw new Error("Challenge mismatch. Please try again.");
  }
  return payload.challenge;
}

async function startSession(userId: string, email: string) {
  const token = await signJwt({ userId, email });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

// ─── Registration ──────────────────────────────────────────────────────────

export async function getRegisterOptions(
  rawEmail: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const email = normalize(rawEmail);

  const user =
    (await findUserByEmail(email)) ?? (await createPasskeyUser(email));
  const existing = await listPasskeysForUser(user.id);

  const options = await generateRegistrationOptions({
    rpName: webauthnConfig.rpName,
    rpID: webauthnConfig.rpID,
    userName: email,
    userID: new TextEncoder().encode(String(user.id)),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: p.credential_id,
      transports: parseTransports(p.transports),
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await setChallengeCookie(email, options.challenge, "register");
  return options;
}

export async function verifyRegister(
  rawEmail: string,
  response: RegistrationResponseJSON,
): Promise<{ success: true }> {
  const email = normalize(rawEmail);
  const expectedChallenge = await consumeChallengeCookie(email, "register");

  const user = await findUserByEmail(email);
  if (!user) throw new Error("User no longer exists.");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: webauthnConfig.origin,
    expectedRPID: webauthnConfig.rpID,
    requireUserVerification: false,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("Registration could not be verified.");
  }

  const { credential } = verification.registrationInfo;
  await insertPasskey({
    userId: user.id,
    credentialId: credential.id,
    publicKey: credential.publicKey,
    counter: credential.counter,
    transports: response.response.transports as
      | RegistrationResponseJSON["response"]["transports"]
      | undefined,
  });

  await startSession(user.id, user.email);
  return { success: true };
}

// ─── Authentication ────────────────────────────────────────────────────────

export async function getAuthOptions(
  rawEmail: string,
): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const email = normalize(rawEmail);
  const user = await findUserByEmail(email);
  // Return options even if user is missing so the response shape doesn't
  // leak account existence — but populate allowCredentials only when we
  // actually have keys.
  const passkeys = user ? await listPasskeysForUser(user.id) : [];

  const options = await generateAuthenticationOptions({
    rpID: webauthnConfig.rpID,
    allowCredentials: passkeys.map((p) => ({
      id: p.credential_id,
      transports: parseTransports(p.transports),
    })),
    userVerification: "preferred",
  });

  await setChallengeCookie(email, options.challenge, "auth");
  return options;
}

export async function verifyAuth(
  rawEmail: string,
  response: AuthenticationResponseJSON,
): Promise<{ success: true }> {
  const email = normalize(rawEmail);
  const expectedChallenge = await consumeChallengeCookie(email, "auth");

  const user = await findUserByEmail(email);
  if (!user) throw new Error("No account found.");

  const passkey = await findPasskeyByCredentialId(response.id);
  if (!passkey || passkey.user_id !== user.id) {
    throw new Error("Passkey not registered for this account.");
  }

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: webauthnConfig.origin,
    expectedRPID: webauthnConfig.rpID,
    credential: {
      id: passkey.credential_id,
      publicKey: new Uint8Array(passkey.credential_public_key),
      counter: Number(passkey.counter),
      transports: parseTransports(passkey.transports),
    },
    requireUserVerification: false,
  });

  if (!verification.verified) {
    throw new Error("Authentication could not be verified.");
  }

  await updatePasskeyCounter(
    passkey.id,
    verification.authenticationInfo.newCounter,
  );
  await startSession(user.id, user.email);
  return { success: true };
}

// ─── Logout ────────────────────────────────────────────────────────────────

export async function logout(): Promise<never> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}

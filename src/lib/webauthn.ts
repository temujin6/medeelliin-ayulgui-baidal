// WebAuthn / passkey config and short-lived challenge cookie.
//
// We don't use iron-session here — the rest of the app already stores its
// session as a `jose` JWT in the `session` cookie. To preserve the challenge
// across the two-request handshake (get-options → verify), we mint a separate
// short-lived JWT and put it in a dedicated cookie.
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is not set");
const encodedKey = new TextEncoder().encode(JWT_SECRET);

export const CHALLENGE_COOKIE = "webauthn_challenge";
const CHALLENGE_AUDIENCE = "webauthn-challenge";

export const webauthnConfig = {
  rpID: process.env.RP_ID ?? "localhost",
  rpName: process.env.RP_NAME ?? "Auth App",
  origin: process.env.ORIGIN ?? "http://localhost:3000",
};

export interface ChallengePayload {
  challenge: string;
  email: string;
  // "register" | "auth" — kept narrow so a register challenge can't be
  // replayed against an auth verification or vice versa.
  purpose: "register" | "auth";
}

export async function signChallengeToken(payload: ChallengePayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(CHALLENGE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(encodedKey);
}

export async function verifyChallengeToken(token: string): Promise<ChallengePayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
      audience: CHALLENGE_AUDIENCE,
    });
    return payload as unknown as ChallengePayload;
  } catch {
    return null;
  }
}

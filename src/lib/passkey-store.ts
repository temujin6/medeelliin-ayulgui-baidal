// Prisma data-access helpers for users and their passkeys.
// Kept out of any "use server" file so they can be imported freely.
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { prisma } from "@/lib/prisma";

export interface UserRow {
  id: string;
  email: string;
}

export interface PasskeyRow {
  id: number;
  user_id: string;
  credential_id: string;
  credential_public_key: Buffer;
  counter: string | number;
  transports: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });
  return user ? { id: user.id, email: user.email } : null;
}

export async function createPasskeyUser(email: string): Promise<UserRow> {
  const user = await prisma.user.create({
    data: { email, password: null },
    select: { id: true, email: true },
  });
  return { id: user.id, email: user.email };
}

export async function listPasskeysForUser(
  userId: string,
): Promise<PasskeyRow[]> {
  const rows = await prisma.passkey.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      credentialId: true,
      credentialPublicKey: true,
      counter: true,
      transports: true,
    },
  });
  return rows.map(
    (row: {
      id: number;
      userId: string;
      credentialId: string;
      credentialPublicKey: Buffer;
      counter: bigint;
      transports: string | null;
    }) => ({
      id: row.id,
      user_id: row.userId,
      credential_id: row.credentialId,
      credential_public_key: Buffer.from(row.credentialPublicKey),
      counter: row.counter.toString(),
      transports: row.transports,
    }),
  );
}

export async function findPasskeyByCredentialId(
  credentialId: string,
): Promise<PasskeyRow | null> {
  const row = await prisma.passkey.findUnique({
    where: { credentialId },
    select: {
      id: true,
      userId: true,
      credentialId: true,
      credentialPublicKey: true,
      counter: true,
      transports: true,
    },
  });

  if (!row) return null;
  return {
    id: row.id,
    user_id: row.userId,
    credential_id: row.credentialId,
    credential_public_key: Buffer.from(row.credentialPublicKey),
    counter: row.counter.toString(),
    transports: row.transports,
  };
}

export async function insertPasskey(args: {
  userId: string;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}): Promise<void> {
  await prisma.passkey.create({
    data: {
      userId: args.userId,
      credentialId: args.credentialId,
      credentialPublicKey: Buffer.from(args.publicKey),
      counter: BigInt(args.counter),
      transports: args.transports?.join(",") ?? null,
    },
  });
}

export async function updatePasskeyCounter(
  passkeyId: number,
  newCounter: number,
): Promise<void> {
  await prisma.passkey.update({
    where: { id: passkeyId },
    data: { counter: BigInt(newCounter) },
  });
}

export function parseTransports(
  raw: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").filter(Boolean) as AuthenticatorTransportFuture[];
}

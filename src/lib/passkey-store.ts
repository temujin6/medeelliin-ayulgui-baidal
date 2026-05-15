// MySQL data-access helpers for users and their passkeys.
// Kept out of any "use server" file so they can be imported freely.
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/server";
import { pool } from "@/lib/db";

export interface UserRow extends RowDataPacket {
  id: number;
  email: string;
}

export interface PasskeyRow extends RowDataPacket {
  id: number;
  user_id: number;
  credential_id: string;
  credential_public_key: Buffer;
  counter: string | number; // BIGINT comes back as string
  transports: string | null;
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const [rows] = await pool.execute<UserRow[]>(
    "SELECT id, email FROM users WHERE email = ?",
    [email],
  );
  return rows[0] ?? null;
}

export async function createPasskeyUser(email: string): Promise<UserRow> {
  // password is nullable (see migrations/002_add_passkey.sql) so a
  // passkey-only account is permitted.
  const [result] = await pool.execute<ResultSetHeader>(
    "INSERT INTO users (email, password) VALUES (?, NULL)",
    [email],
  );
  return { id: result.insertId, email } as UserRow;
}

export async function listPasskeysForUser(userId: number): Promise<PasskeyRow[]> {
  const [rows] = await pool.execute<PasskeyRow[]>(
    "SELECT id, user_id, credential_id, credential_public_key, counter, transports FROM passkeys WHERE user_id = ?",
    [userId],
  );
  return rows;
}

export async function findPasskeyByCredentialId(
  credentialId: string,
): Promise<PasskeyRow | null> {
  const [rows] = await pool.execute<PasskeyRow[]>(
    "SELECT id, user_id, credential_id, credential_public_key, counter, transports FROM passkeys WHERE credential_id = ?",
    [credentialId],
  );
  return rows[0] ?? null;
}

export async function insertPasskey(args: {
  userId: number;
  credentialId: string;
  publicKey: Uint8Array;
  counter: number;
  transports?: AuthenticatorTransportFuture[];
}): Promise<void> {
  await pool.execute(
    "INSERT INTO passkeys (user_id, credential_id, credential_public_key, counter, transports) VALUES (?, ?, ?, ?, ?)",
    [
      args.userId,
      args.credentialId,
      Buffer.from(args.publicKey),
      args.counter,
      args.transports?.join(",") ?? null,
    ],
  );
}

export async function updatePasskeyCounter(
  passkeyId: number,
  newCounter: number,
): Promise<void> {
  await pool.execute("UPDATE passkeys SET counter = ? WHERE id = ?", [
    newCounter,
    passkeyId,
  ]);
}

export function parseTransports(
  raw: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!raw) return undefined;
  return raw.split(",").filter(Boolean) as AuthenticatorTransportFuture[];
}

// JWT helpers — uses `jose` which is edge-runtime compatible
// (works in both API routes and proxy.ts)
import { SignJWT, jwtVerify } from "jose";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET env variable is not set");

const encodedKey = new TextEncoder().encode(JWT_SECRET);

export interface JwtPayload {
  userId: string;
  email: string;
}

/**
 * Signs a JWT that expires in 7 days.
 * Store in an HTTP-only cookie after successful OTP verification.
 */
export async function signJwt(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(encodedKey);
}

/**
 * Verifies a JWT and returns its payload, or null if invalid/expired.
 */
export async function verifyJwt(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, encodedKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/** Cryptographically random 6-digit OTP */
export function generateOtp(): string {
  // crypto.getRandomValues is available in both Node.js 19+ and Edge
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Map to 000000–999999
  return String(array[0] % 1_000_000).padStart(6, "0");
}

/** Returns a Date 5 minutes from now */
export function otpExpiry(): Date {
  return new Date(Date.now() + 5 * 60 * 1000);
}

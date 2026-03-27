// Handles two verification scenarios:
//   type: "login"   — verify the 2FA OTP after a correct password, issues JWT
//   type: "unblock" — verify the unlock OTP, resets the account block
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { pool } from "@/lib/db";
import { signJwt } from "@/lib/auth";
import { cookies } from "next/headers";
import { OtpType } from "@/lib/otp-type";
import type { RowDataPacket } from "mysql2";

const VerifySchema = z.object({
  email: z.email({ error: "Invalid email." }),
  otp: z.string().length(6, { error: "OTP must be 6 digits." }),
  type: z.enum(["login", "unblock"]),
});

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  otp_code: string | null;
  otp_expiry: Date | null;
  otp_type: "LOGIN" | "UNBLOCK" | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 }
      );
    }

    const { email, otp, type } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, email, otp_code, otp_expiry, otp_type FROM users WHERE email = ?",
      [normalizedEmail]
    );
    const user = rows[0] ?? null;

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // Make sure the OTP type matches what was requested
    const expectedType = type === "login" ? OtpType.LOGIN : OtpType.UNBLOCK;

    if (!user.otp_code || !user.otp_expiry || user.otp_type !== expectedType) {
      return NextResponse.json(
        { message: "No pending verification for this account." },
        { status: 400 }
      );
    }

    // Check expiry
    if (new Date() > user.otp_expiry) {
      return NextResponse.json(
        { message: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Constant-time comparison to prevent timing attacks
    if (otp !== user.otp_code) {
      return NextResponse.json(
        { message: "Invalid verification code." },
        { status: 400 }
      );
    }

    // ── OTP is valid — clear it ──────────────────────────────────────────────
    if (type === "unblock") {
      await pool.execute(
        "UPDATE users SET is_blocked = 0, failed_attempts = 0, otp_code = NULL, otp_expiry = NULL, otp_type = NULL WHERE id = ?",
        [user.id]
      );

      return NextResponse.json({
        status: "unblocked",
        message: "Account unlocked successfully. You can now log in.",
      });
    }

    // type === "login": issue JWT session cookie
    await pool.execute(
      "UPDATE users SET otp_code = NULL, otp_expiry = NULL, otp_type = NULL WHERE id = ?",
      [user.id]
    );

    const token = await signJwt({ userId: String(user.id), email: user.email });

    // HTTP-only cookie — 7-day session
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
    });

    return NextResponse.json({
      status: "authenticated",
      message: "Login successful.",
    });
  } catch (err) {
    console.error("[verify]", err);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

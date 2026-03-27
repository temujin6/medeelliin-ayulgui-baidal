import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { pool } from "@/lib/db";
import { generateOtp, otpExpiry } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";
import { OtpType } from "@/lib/otp-type";
import type { RowDataPacket } from "mysql2";

const MAX_FAILED_ATTEMPTS = 3;

const LoginSchema = z.object({
  email: z.email({ error: "Invalid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

interface UserRow extends RowDataPacket {
  id: number;
  email: string;
  password: string;
  failed_attempts: number;
  is_blocked: number; // TINYINT(1): 0 or 1
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = LoginSchema.safeParse(body);

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error).fieldErrors;
      return NextResponse.json({ errors }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const [rows] = await pool.execute<UserRow[]>(
      "SELECT id, email, password, failed_attempts, is_blocked FROM users WHERE email = ?",
      [normalizedEmail]
    );
    const user = rows[0] ?? null;

    // Use a generic message to avoid user enumeration
    if (!user) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 }
      );
    }

    // ── Account is already blocked ──────────────────────────────────────────
    if (user.is_blocked) {
      return NextResponse.json(
        {
          status: "blocked",
          message:
            "Account blocked. Enter the OTP sent to your email to unlock it.",
        },
        { status: 403 }
      );
    }

    // ── Verify password ─────────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const newAttempts = user.failed_attempts + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Generate an UNBLOCK OTP and lock the account
        const otp = generateOtp();
        const expiry = otpExpiry();

        await pool.execute(
          "UPDATE users SET failed_attempts = ?, is_blocked = 1, otp_code = ?, otp_expiry = ?, otp_type = ? WHERE id = ?",
          [newAttempts, otp, expiry, OtpType.UNBLOCK, user.id]
        );

        await sendOtpEmail({
          to: user.email,
          otp,
          subject: "Your account has been temporarily locked",
          purpose: "unlock your account",
        });

        return NextResponse.json(
          {
            status: "blocked",
            message:
              "Too many failed attempts. Your account has been locked. Check your email for an unlock code.",
          },
          { status: 403 }
        );
      }

      // Not yet blocked — update the counter
      await pool.execute(
        "UPDATE users SET failed_attempts = ? WHERE id = ?",
        [newAttempts, user.id]
      );

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          message: `Invalid password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before your account is locked.`,
        },
        { status: 401 }
      );
    }

    // ── Password correct — send 2FA OTP ─────────────────────────────────────
    const otp = generateOtp();
    const expiry = otpExpiry();

    await pool.execute(
      "UPDATE users SET failed_attempts = 0, otp_code = ?, otp_expiry = ?, otp_type = ? WHERE id = ?",
      [otp, expiry, OtpType.LOGIN, user.id]
    );

    await sendOtpEmail({
      to: user.email,
      otp,
      subject: "Your login verification code",
      purpose: "verify your login",
    });

    return NextResponse.json({
      status: "otp_sent",
      message: "A verification code has been sent to your email.",
      email: normalizedEmail, // returned so the frontend can pre-fill the verify form
    });
  } catch (err) {
    console.error("[login]", err);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

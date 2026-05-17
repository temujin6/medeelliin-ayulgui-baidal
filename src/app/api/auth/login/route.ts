import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOtp, otpExpiry } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";
import { OtpType } from "@/lib/otp-type";

const MAX_FAILED_ATTEMPTS = 3;

const LoginSchema = z.object({
  email: z.email({ error: "Invalid email address." }),
  password: z.string().min(1, { error: "Password is required." }),
});

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

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
        failedAttempts: true,
        isBlocked: true,
      },
    });

    // Use a generic message to avoid user enumeration
    if (!user || !user.password) {
      return NextResponse.json(
        { message: "Invalid email or password." },
        { status: 401 },
      );
    }

    // ── Account is already blocked ──────────────────────────────────────────
    if (user.isBlocked) {
      return NextResponse.json(
        {
          status: "blocked",
          message:
            "Account blocked. Enter the OTP sent to your email to unlock it.",
        },
        { status: 403 },
      );
    }

    // ── Verify password ─────────────────────────────────────────────────────
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      const newAttempts = user.failedAttempts + 1;

      if (newAttempts >= MAX_FAILED_ATTEMPTS) {
        // Generate an UNBLOCK OTP and lock the account
        const otp = generateOtp();
        const expiry = otpExpiry();

        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedAttempts: newAttempts,
            isBlocked: true,
            otpCode: otp,
            otpExpiry: expiry,
            otpType: OtpType.UNBLOCK,
          },
        });

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
          { status: 403 },
        );
      }

      // Not yet blocked — update the counter
      await prisma.user.update({
        where: { id: user.id },
        data: { failedAttempts: newAttempts },
      });

      const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
      return NextResponse.json(
        {
          message: `Invalid password. ${remaining} attempt${remaining !== 1 ? "s" : ""} remaining before your account is locked.`,
        },
        { status: 401 },
      );
    }

    // ── Password correct — send 2FA OTP ─────────────────────────────────────
    const otp = generateOtp();
    const expiry = otpExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedAttempts: 0,
        otpCode: otp,
        otpExpiry: expiry,
        otpType: OtpType.LOGIN,
      },
    });

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
      { status: 500 },
    );
  }
}

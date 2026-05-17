// Handles two verification scenarios:
//   type: "login"   — verify the 2FA OTP after a correct password, issues JWT
//   type: "unblock" — verify the unlock OTP, resets the account block
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signJwt } from "@/lib/auth";
import { cookies } from "next/headers";
import { OtpType } from "@/lib/otp-type";

const VerifySchema = z.object({
  email: z.email({ error: "Invalid email." }),
  otp: z.string().length(6, { error: "OTP must be 6 digits." }),
  type: z.enum(["login", "unblock"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = VerifySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const { email, otp, type } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        otpCode: true,
        otpExpiry: true,
        otpType: true,
      },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    // Make sure the OTP type matches what was requested
    const expectedType = type === "login" ? OtpType.LOGIN : OtpType.UNBLOCK;

    if (!user.otpCode || !user.otpExpiry || user.otpType !== expectedType) {
      return NextResponse.json(
        { message: "No pending verification for this account." },
        { status: 400 },
      );
    }

    // Check expiry
    if (new Date() > user.otpExpiry) {
      return NextResponse.json(
        { message: "Verification code has expired. Please request a new one." },
        { status: 400 },
      );
    }

    // Constant-time comparison to prevent timing attacks
    if (otp !== user.otpCode) {
      return NextResponse.json(
        { message: "Invalid verification code." },
        { status: 400 },
      );
    }

    // ── OTP is valid — clear it ──────────────────────────────────────────────
    if (type === "unblock") {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          isBlocked: false,
          failedAttempts: 0,
          otpCode: null,
          otpExpiry: null,
          otpType: null,
        },
      });

      return NextResponse.json({
        status: "unblocked",
        message: "Account unlocked successfully. You can now log in.",
      });
    }

    // type === "login": issue JWT session cookie
    await prisma.user.update({
      where: { id: user.id },
      data: {
        otpCode: null,
        otpExpiry: null,
        otpType: null,
      },
    });

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
      { status: 500 },
    );
  }
}

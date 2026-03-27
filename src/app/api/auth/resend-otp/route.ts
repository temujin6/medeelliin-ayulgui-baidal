// Resend OTP — for both login 2FA and account-unlock scenarios
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { generateOtp, otpExpiry } from "@/lib/auth";
import { sendOtpEmail } from "@/lib/mailer";
import { OtpType } from "@/generated/prisma/enums";

const ResendSchema = z.object({
  email: z.email({ error: "Invalid email." }),
  type: z.enum(["login", "unblock"]),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ResendSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email, type } = parsed.data;
    const normalizedEmail = email.toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, isBlocked: true, otpType: true },
    });

    // Always respond with success to prevent user enumeration
    if (!user) {
      return NextResponse.json({
        message: "If that account exists, a new code has been sent.",
      });
    }

    // Validate that the requested resend type matches the account state
    const expectedType =
      type === "login" ? OtpType.LOGIN : OtpType.UNBLOCK;

    if (user.otpType !== expectedType) {
      return NextResponse.json(
        { message: "No pending verification of that type for this account." },
        { status: 400 }
      );
    }

    const otp = generateOtp();
    const expiry = otpExpiry();

    await prisma.user.update({
      where: { id: user.id },
      data: { otpCode: otp, otpExpiry: expiry },
    });

    const isUnblock = type === "unblock";
    await sendOtpEmail({
      to: normalizedEmail,
      otp,
      subject: isUnblock
        ? "Your account unlock code"
        : "Your new login verification code",
      purpose: isUnblock ? "unlock your account" : "verify your login",
    });

    return NextResponse.json({
      message: "A new verification code has been sent to your email.",
    });
  } catch (err) {
    console.error("[resend-otp]", err);
    return NextResponse.json(
      { message: "Internal server error." },
      { status: 500 }
    );
  }
}

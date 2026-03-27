// Reusable email utility using Nodemailer
// Works with any SMTP provider — see .env.example for Gmail setup
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT ?? 587),
  secure: Number(process.env.EMAIL_PORT) === 465, // true for 465, false for 587/25
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

interface SendOtpOptions {
  to: string;
  otp: string;
  subject: string;
  purpose: string; // "verify your login" | "unlock your account"
}

/**
 * Sends a 6-digit OTP email.
 * Expires in 5 minutes.
 */
export async function sendOtpEmail({
  to,
  otp,
  subject,
  purpose,
}: SendOtpOptions): Promise<void> {
  await transporter.sendMail({
    from: process.env.EMAIL_FROM ?? process.env.EMAIL_USER,
    to,
    subject,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Your verification code</h2>
        <p>Use the code below to ${purpose}.</p>
        <div style="font-size:2.5rem;font-weight:700;letter-spacing:0.25em;
                    background:#f3f4f6;border-radius:8px;padding:20px;
                    text-align:center;color:#111827;">${otp}</div>
        <p style="color:#6b7280;font-size:0.875rem;margin-top:16px;">
          This code expires in <strong>5 minutes</strong>.
          If you did not request this, ignore this email.
        </p>
      </div>
    `,
  });
}

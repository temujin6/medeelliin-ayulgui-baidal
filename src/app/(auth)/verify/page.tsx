"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VerifyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const email = searchParams.get("email") ?? "";
  const type = (searchParams.get("type") ?? "login") as "login" | "unblock";

  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Cooldown timer for resend button
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  function handleOtpChange(index: number, value: string) {
    // Accept only digits
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...otp];
    next[index] = digit;
    setOtp(next);

    // Auto-advance
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handleOtpPaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      inputRefs.current[5]?.focus();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = otp.join("");
    if (code.length !== 6) {
      setMessage("Please enter all 6 digits.");
      return;
    }

    setMessage("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp: code, type }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.message ?? "Verification failed.");
        return;
      }

      if (type === "unblock") {
        router.push("/login?unlocked=1");
      } else {
        router.push("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setMessage("");
    setResendCooldown(60);

    try {
      const res = await fetch("/api/auth/resend-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, type }),
      });
      const data = await res.json();
      setMessage(data.message);
    } catch {
      setMessage("Failed to resend code.");
    }
  }

  const isUnblock = type === "unblock";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">
        {isUnblock ? "Unlock your account" : "Verify your email"}
      </h1>
      <p className="text-sm text-gray-500 mb-6">
        {isUnblock
          ? "Enter the 6-digit unlock code sent to "
          : "Enter the 6-digit code sent to "}
        <span className="font-medium text-gray-700">{email}</span>
        . It expires in 5 minutes.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* OTP input boxes */}
        <div className="flex gap-2 justify-center" onPaste={handleOtpPaste}>
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el; }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleOtpChange(i, e.target.value)}
              onKeyDown={(e) => handleOtpKeyDown(i, e)}
              disabled={loading}
              className="w-12 h-14 text-center text-xl font-semibold rounded-lg
                         border border-gray-300 focus:outline-none focus:ring-2
                         focus:ring-blue-500 focus:border-transparent
                         disabled:bg-gray-50 caret-transparent"
              aria-label={`Digit ${i + 1}`}
            />
          ))}
        </div>

        {message && (
          <p className="text-sm text-center text-red-600 bg-red-50 rounded-lg px-3 py-2">
            {message}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-medium py-2 px-4 rounded-lg text-sm
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loading
            ? "Verifying…"
            : isUnblock
            ? "Unlock account"
            : "Verify & sign in"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <button
          onClick={handleResend}
          disabled={resendCooldown > 0 || loading}
          className="text-sm text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
        >
          {resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend code"}
        </button>
      </div>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyForm />
    </Suspense>
  );
}

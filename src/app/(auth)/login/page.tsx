"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");
  const [isBlocked, setIsBlocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Show success banner when arriving from signup
  useEffect(() => {
    if (searchParams.get("registered") === "1") {
      setMessageType("success");
      setMessage("Account created! You can now log in.");
    }
    if (searchParams.get("unlocked") === "1") {
      setMessageType("success");
      setMessage("Account unlocked! Please log in.");
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setIsBlocked(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (res.status === 403 && data.status === "blocked") {
        setIsBlocked(true);
        setMessageType("error");
        setMessage(data.message);
        return;
      }

      if (!res.ok) {
        setMessageType("error");
        setMessage(data.message ?? "Something went wrong.");
        return;
      }

      // Success: OTP sent — go to verification page
      router.push(`/verify?email=${encodeURIComponent(data.email)}&type=login`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Welcome back</h1>
      <p className="text-sm text-gray-500 mb-6">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="text-blue-600 hover:underline">
          Sign up
        </Link>
      </p>

      {message && (
        <div
          className={`text-sm rounded-lg px-3 py-2 mb-4 ${
            messageType === "success"
              ? "bg-green-50 text-green-700"
              : "bg-red-50 text-red-600"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate className="space-y-4 text-black">
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-50"
            disabled={loading}
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-50"
            disabled={loading}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-medium py-2 px-4 rounded-lg text-sm
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {/* Account locked — send to unblock flow */}
      {isBlocked && (
        <div className="mt-4 text-center">
          <Link
            href={`/verify?email=${encodeURIComponent(email)}&type=unblock`}
            className="text-sm text-blue-600 hover:underline"
          >
            Enter unlock code →
          </Link>
        </div>
      )}

      <div className="mt-6 pt-6 border-t border-gray-100 text-center">
        <Link
          href="/passkey"
          className="text-sm text-blue-600 hover:underline"
        >
          Sign in with a passkey instead →
        </Link>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    // useSearchParams requires Suspense in Next.js App Router
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

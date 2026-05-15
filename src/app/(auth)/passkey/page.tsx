"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  startAuthentication,
  startRegistration,
} from "@simplewebauthn/browser";
import {
  getAuthOptions,
  getRegisterOptions,
  verifyAuth,
  verifyRegister,
} from "@/app/auth/actions";

type Mode = "register" | "auth";

const REDIRECT_TARGET = "/dashboard";
const SUCCESS_HOLD_MS = 1200;

export default function PasskeyPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState<Mode | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  function reset() {
    setError("");
    setSuccess("");
  }

  async function handleRegister() {
    reset();
    setLoading("register");
    try {
      const options = await getRegisterOptions(email);
      const response = await startRegistration({ optionsJSON: options });
      await verifyRegister(email, response);
      setSuccess("Passkey saved! You can now sign in.");
      // Brief pause so the user actually sees the confirmation.
      setTimeout(() => router.push(REDIRECT_TARGET), SUCCESS_HOLD_MS);
    } catch (err) {
      setError(friendlyError(err, "register"));
      setLoading(null);
    }
  }

  async function handleSignIn() {
    reset();
    setLoading("auth");
    try {
      const options = await getAuthOptions(email);
      const response = await startAuthentication({ optionsJSON: options });
      await verifyAuth(email, response);
      router.push(REDIRECT_TARGET);
    } catch (err) {
      setError(friendlyError(err, "auth"));
      setLoading(null);
    }
  }

  const busy = loading !== null;
  const disabled = busy || !email;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Passkey sign-in</h1>
      <p className="text-sm text-gray-500 mb-6">
        First time? <strong className="font-semibold">Register</strong> a passkey.
        Already set up? <strong className="font-semibold">Sign in</strong>.{" "}
        <Link href="/login" className="text-blue-600 hover:underline">
          Use password instead
        </Link>
      </p>

      {error && (
        <div
          role="alert"
          className="text-sm rounded-lg px-3 py-2 mb-4 bg-red-50 text-red-700 border border-red-100"
        >
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          className="text-sm rounded-lg px-3 py-2 mb-4 bg-green-50 text-green-700 border border-green-100"
        >
          {success}
        </div>
      )}

      <div className="space-y-4 text-black">
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
            autoComplete="username webauthn"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                       disabled:bg-gray-50"
            disabled={busy}
          />
        </div>

        <button
          type="button"
          onClick={handleRegister}
          disabled={disabled}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400
                     text-white font-medium py-2.5 px-4 rounded-lg text-sm
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loading === "register" ? "Registering…" : "Register Passkey"}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-2 text-gray-400">already registered?</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleSignIn}
          disabled={disabled}
          className="w-full border border-gray-300 hover:bg-gray-100 disabled:opacity-60
                     text-gray-800 font-medium py-2.5 px-4 rounded-lg text-sm
                     transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {loading === "auth" ? "Authenticating…" : "Sign in with Passkey"}
        </button>
      </div>
    </div>
  );
}

// WebAuthn DOMExceptions are technical; map the common ones to human guidance.
function friendlyError(err: unknown, mode: Mode): string {
  const name =
    err instanceof DOMException
      ? err.name
      : typeof err === "object" && err !== null && "name" in err
        ? String((err as { name: unknown }).name)
        : "";

  if (name === "NotAllowedError") {
    return mode === "auth"
      ? 'No matching passkey was available, or the prompt was cancelled. If this is your first time, click "Register Passkey" above.'
      : "Passkey registration was cancelled. Please try again.";
  }
  if (name === "InvalidStateError") {
    return 'A passkey for this account is already registered on this device. Click "Sign in with Passkey" instead.';
  }
  if (name === "NotSupportedError") {
    return "This browser or device does not support passkeys.";
  }
  if (name === "SecurityError") {
    return "Passkeys require HTTPS or localhost. Check the ORIGIN/RP_ID env vars.";
  }
  if (err instanceof Error && err.message) return err.message;
  return "Something went wrong. Please try again.";
}

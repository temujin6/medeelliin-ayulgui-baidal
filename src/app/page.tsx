import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">
          Secure Auth
        </h1>
        <p className="text-gray-500 mb-8">
          Production-ready authentication with brute-force protection,
          email OTP, and JWT sessions.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/signup"
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium
                       py-2.5 px-6 rounded-lg text-sm transition-colors"
          >
            Create account
          </Link>
          <Link
            href="/login"
            className="border border-gray-300 hover:bg-gray-100 text-gray-700
                       font-medium py-2.5 px-6 rounded-lg text-sm transition-colors"
          >
            Sign in
          </Link>
        </div>
      </div>
    </main>
  );
}

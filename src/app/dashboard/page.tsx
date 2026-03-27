// Protected server component — only reachable with a valid session cookie
// (proxy.ts redirects unauthenticated requests to /login)
import { cookies } from "next/headers";
import { verifyJwt } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "./logout-button";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  const payload = token ? await verifyJwt(token) : null;

  // Double-check on the server (proxy.ts already handles redirects, but defence-in-depth)
  if (!payload) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-1 text-sm text-gray-500">
                Logged in as{" "}
                <span className="font-medium text-gray-700">
                  {payload.email}
                </span>
              </p>
            </div>
            <LogoutButton />
          </div>

          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Account", value: "Active" },
              { label: "Auth method", value: "Email + OTP" },
              { label: "Session", value: "7 days" },
            ].map((card) => (
              <div
                key={card.label}
                className="rounded-xl bg-gray-50 border border-gray-100 p-4"
              >
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {card.label}
                </p>
                <p className="mt-1 text-lg font-semibold text-gray-800">
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

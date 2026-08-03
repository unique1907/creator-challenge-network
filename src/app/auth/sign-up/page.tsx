import type { Metadata } from "next";
import Link from "next/link";
import { SignUpEntry } from "@/features/auth/components/sign-up-entry";

export const metadata: Metadata = {
  title: "Sign up | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type SignUpPageProps = {
  searchParams?: Promise<{
    role?: string;
    setup?: string;
    roleConflict?: string;
    next?: string;
  }>;
};

function validRole(value?: string) {
  return value === "brand" || value === "creator" ? value : null;
}

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function signInPath(input: { role: "brand" | "creator" | null; nextPath: string | null }) {
  const params = new URLSearchParams();
  if (input.role) params.set("role", input.role);
  if (input.nextPath) params.set("next", input.nextPath);
  const query = params.toString();
  return query ? `/auth/sign-in?${query}` : "/auth/sign-in";
}

export default async function SignUpPage({ searchParams }: SignUpPageProps) {
  const params = await searchParams;
  const role = validRole(params?.role);
  const setupRequired = params?.setup === "1";
  const roleConflict = validRole(params?.roleConflict);
  const nextPath = safeNextPath(params?.next);

  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-4xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator Challenge Network</p>
        {setupRequired ? (
          <div className="mt-5 rounded-2xl border border-cyan-300/20 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-100">
            Your account is signed in. Continue setup for the selected workspace before accessing protected tools.
          </div>
        ) : null}
        {roleConflict ? (
          <div className="mt-5 rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">
            This account is registered as a {roleConflict === "brand" ? "Brand" : "Creator"}. {roleConflict === "brand" ? "Creator" : "Brand"} accounts must use a separate sign-in.
          </div>
        ) : null}
        <SignUpEntry initialRole={role} nextPath={nextPath} />
        <div className="mt-8 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
          <Link href={signInPath({ role, nextPath })} className="text-blue-300 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Already have an account? Log in
          </Link>
          <Link href="/" className="text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

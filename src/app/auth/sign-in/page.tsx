import type { Metadata } from "next";
import Link from "next/link";
import { AuthActions } from "@/features/auth/components/auth-actions";

export const metadata: Metadata = {
  title: "Sign in | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type SignInPageProps = {
  searchParams?: Promise<{
    error?: string;
    role?: string;
    next?: string;
  }>;
};

function validRole(value?: string) {
  return value === "brand" || value === "creator" ? value : null;
}

function safeNextPath(value?: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return undefined;
  return value;
}

function signUpPath(input: { role: "brand" | "creator" | null; nextPath?: string }) {
  const params = new URLSearchParams();
  if (input.role) params.set("role", input.role);
  if (input.nextPath) params.set("next", input.nextPath);
  const query = params.toString();
  return query ? `/auth/sign-up?${query}` : "/auth/sign-up";
}

function authErrorMessage(code?: string) {
  if (code === "callback_expired") return "That email link expired or was already used. Log in with your password or request a reset.";
  if (code === "callback") return "We could not verify that email link. Log in with your password or request a reset.";
  if (code === "session") return "Your session could not be restored. Please sign in again.";
  return "";
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const errorMessage = authErrorMessage(params?.error);
  const role = validRole(params?.role);
  const nextPath = safeNextPath(params?.next);

  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-[#D9DEE7] bg-[#F3F4F6] p-8 shadow-xl shadow-black/20">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-violet-700">Creator Challenge Network</p>
        <h1 className="mt-3 text-3xl font-semibold text-slate-950">Welcome back</h1>
        <p className="mt-3 text-slate-600">
          Sign in to continue to your CCN workspace.
        </p>
        {errorMessage ? <p className="mt-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</p> : null}
        <AuthActions mode="sign-in" roleIntent={role} nextPath={nextPath} surface="light" showCreateAccountLink={false} />
        <div className="mt-6 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
          <Link href={signUpPath({ role, nextPath })} className="text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Create account
          </Link>
          <Link href="/" className="text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

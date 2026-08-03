import type { Metadata } from "next";
import Link from "next/link";
import { UpdatePasswordForm } from "@/features/auth/components/update-password-form";

export const metadata: Metadata = {
  title: "Update password | Creator Challenge Network",
  robots: { index: false, follow: false },
};

type UpdatePasswordPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

function errorMessage(code?: string) {
  if (code === "callback_expired") return "This reset link is expired or was already used. Request a new password reset.";
  if (code === "callback") return "This reset link could not be verified. Request a new password reset.";
  return "";
}

export default async function UpdatePasswordPage({ searchParams }: UpdatePasswordPageProps) {
  const params = await searchParams;
  const error = errorMessage(params?.error);

  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator Challenge Network</p>
        <h1 className="mt-3 text-3xl font-semibold">Update password</h1>
        <p className="mt-3 text-slate-300">
          Set a new password after opening your reset email.
        </p>
        {error ? <p className="mt-5 rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{error}</p> : null}
        <UpdatePasswordForm />
        <div className="mt-6 flex flex-col gap-3 text-sm font-semibold sm:flex-row sm:items-center sm:justify-between">
          <Link href="/auth/forgot-password" className="text-blue-300 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Request a new reset
          </Link>
          <Link href="/auth/sign-in" className="text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}

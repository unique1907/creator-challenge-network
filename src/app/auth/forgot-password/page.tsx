import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-[#050916] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl rounded-3xl border border-white/10 bg-[#0c1222] p-8 shadow-2xl shadow-black/40">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Creator Challenge Network</p>
        <h1 className="mt-3 text-3xl font-semibold">Set or reset password</h1>
        <p className="mt-3 text-slate-300">
          Use this for an existing magic-link account or when you need a new password.
        </p>
        <ForgotPasswordForm />
        <Link href="/auth/sign-in" className="mt-6 inline-flex text-sm font-semibold text-blue-300 hover:text-blue-200 focus:outline-none focus:ring-2 focus:ring-cyan-200">
          Back to login
        </Link>
      </div>
    </main>
  );
}

import Link from "next/link";
import { StatusBadge } from "./status-badge";

export function CreateChallengeSuccessPlaceholder() {
  return (
    <main className="min-h-screen bg-[#030a1f] px-6 py-16 text-white sm:px-8 lg:px-10">
      <section className="mx-auto max-w-3xl rounded-xl border border-white/10 bg-white/[0.04] p-8 shadow-2xl shadow-slate-950/40">
        <div className="flex flex-wrap gap-2">
          <StatusBadge tone="demo">Demo route</StatusBadge>
          <StatusBadge tone="testnet">Arc Testnet</StatusBadge>
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight">
          Create Challenge success placeholder
        </h1>
        <p className="mt-4 text-sm leading-6 text-slate-300">
          This route is reserved for the future post-deployment confirmation
          state. No wallet, escrow, Circle, backend, or smart-contract action is
          performed here.
        </p>
        <Link
          href="/create-challenge?new=1"
          className="mt-8 inline-flex h-11 items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-bold text-white transition hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-200"
        >
          Back to Create Challenge
        </Link>
      </section>
    </main>
  );
}

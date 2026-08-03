import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const metadata: Metadata = {
  title: "Settings | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandSettingsPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");

  return (
    <main className="min-h-screen bg-[#030711] px-5 py-6 text-white xl:px-9">
      <div className="mx-auto max-w-5xl">
        <Link href="/dashboard" className="text-sm font-semibold text-blue-300">Back to dashboard</Link>
        <h1 className="mt-4 text-3xl font-black tracking-tight">Settings</h1>
        <p className="mt-2 max-w-3xl text-slate-400">
          Workspace preferences and integration context for the Brand Command Center. Profile and company identity remain in the account menu.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <SettingsCard
            title="General"
            eyebrow="Workspace"
            lines={[
              ["Current workspace", "Brand Workspace"],
              ["Environment", "Arc Testnet"],
              ["Brand onboarding", context.brandOnboardingComplete ? "Completed" : "Incomplete"],
            ]}
          />
          <SettingsCard
            title="Notifications"
            eyebrow="Action Center"
            lines={[
              ["Behavior", "Derived from campaign state"],
              ["Persistent read state", "Not enabled in MVP"],
              ["Routes", "Open the relevant campaign workspace tab"],
            ]}
          />
          <SettingsCard
            title="Security"
            eyebrow="Authentication"
            lines={[
              ["Provider", context.provider],
              ["Signed-in email", context.email ?? "Unavailable"],
              ["Session action", "Use the account menu to sign out"],
            ]}
          />
          <SettingsCard
            title="Integrations"
            eyebrow="Arc / Circle"
            lines={[
              ["Network", "Arc Testnet"],
              ["Wallet approvals", "Circle Hosted Wallets"],
              ["Settlement asset", "USDC"],
            ]}
          />
          <SettingsCard
            title="AI Templates"
            eyebrow="Beta"
            lines={[
              ["Status", "In development"],
              ["Current behavior", "Read-only product information"],
              ["Persistence", "No editable AI preferences yet"],
            ]}
          />
        </div>

        <section className="mt-6 rounded-xl border border-white/10 bg-white/[0.035] p-5">
          <h2 className="text-sm font-black text-white">Related account settings</h2>
          <p className="mt-2 text-sm text-slate-400">These remain available from the canonical Brand Account menu.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/settings/profile" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white/[0.05]">
              Brand profile
            </Link>
            <Link href="/dashboard/settings/company" className="inline-flex h-10 items-center rounded-lg border border-white/10 px-4 text-sm font-black text-white transition hover:bg-white/[0.05]">
              Company settings
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

function SettingsCard({
  title,
  eyebrow,
  lines,
}: {
  title: string;
  eyebrow: string;
  lines: Array<[string, string]>;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-3 text-xl font-black">{title}</h2>
      <dl className="mt-4 divide-y divide-white/10">
        {lines.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[150px_1fr] gap-4 py-3">
            <dt className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-sm font-semibold text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

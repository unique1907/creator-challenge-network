import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getBrandAccountControlData } from "@/features/dashboard/brand-account-controls.server";
import { BrandAccountControls } from "@/features/dashboard/components/brand-workspace-navigation";
import { getAuthenticatedCcnContext } from "@/services/auth/ccn-auth.server";

export const metadata: Metadata = {
  title: "Settings | Creator Challenge Network",
  robots: { index: false, follow: false },
};

export default async function BrandSettingsPage() {
  const context = await getAuthenticatedCcnContext({ workspace: "brand", allowTestContext: true });
  if (!context) redirect("/auth/sign-in");
  if (!context.brandAccess) redirect("/dashboard/creator");
  const accountControls = await getBrandAccountControlData(context);

  return (
    <main className="min-h-screen bg-[#030711] px-3 py-3 text-white xl:px-5">
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/dashboard" className="text-[12px] font-semibold text-blue-300">Back to dashboard</Link>
            <h1 className="mt-1.5 text-lg font-semibold leading-[1.12] tracking-normal md:text-xl">Settings</h1>
            <p className="mt-1 max-w-3xl text-[12px] text-slate-400">
              Manage Brand profile, company identity, account access, and payment context for the Brand Workspace.
            </p>
          </div>
          <BrandAccountControls {...accountControls} />
        </header>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <SettingsCard
            title="Profile"
            eyebrow="Brand account"
            lines={[
              ["Signed-in email", context.email ?? "Unavailable"],
              ["Profile status", "Available"],
              ["Action", "Update public Brand profile details"],
            ]}
            href="/dashboard/settings/profile"
            cta="Edit profile"
          />
          <SettingsCard
            title="Company"
            eyebrow="Business identity"
            lines={[
              ["Brand onboarding", context.brandOnboardingComplete ? "Completed" : "Incomplete"],
              ["Workspace", "Brand Workspace"],
              ["Action", "Keep company details current"],
            ]}
            href="/dashboard/settings/company"
            cta="Edit company"
          />
          <SettingsCard
            title="Account Access"
            eyebrow="Security"
            lines={[
              ["Login method", "Email and password"],
              ["Session", "Protected Brand access"],
              ["Session action", "Use the account menu to sign out"],
            ]}
          />
          <SettingsCard
            title="Wallet"
            eyebrow="Payments"
            lines={[
              ["Wallet", "Brand payment wallet"],
              ["Funding", "Business challenge prizes"],
              ["Settlement", "Selected solution payouts"],
            ]}
            href="/dashboard/wallet"
            cta="Open wallet"
          />
          <SettingsCard
            title="Notifications"
            eyebrow="Workspace"
            lines={[
              ["Action center", "Business challenge activity"],
              ["Priority source", "Solutions, funding, selection, settlement"],
              ["Delivery", "In-product"],
            ]}
          />
          <SettingsCard
            title="Network"
            eyebrow="Secondary"
            lines={[
              ["Network", "Arc Testnet"],
              ["Asset", "test USDC"],
              ["Explorer", "Available through payment evidence"],
            ]}
            href="/dashboard/payments"
            cta="View payments"
          />
        </div>

        <section className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
          <h2 className="text-[13px] font-semibold text-white">AI Templates (BETA)</h2>
          <p className="mt-1 text-[11px] text-slate-400">AI Templates remain available from the sidebar as a beta workspace helper.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link href="/dashboard/payments" className="inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
              View payments
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
  href,
  cta,
}: {
  title: string;
  eyebrow: string;
  lines: Array<[string, string]>;
  href?: string;
  cta?: string;
}) {
  return (
    <section className="rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-cyan-200">{eyebrow}</p>
      <h2 className="mt-0.5 text-[13px] font-semibold">{title}</h2>
      <dl className="mt-2 divide-y divide-white/10">
        {lines.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[112px_1fr] gap-2 py-1.5">
            <dt className="text-[9px] font-medium uppercase tracking-[0.06em] text-slate-500">{label}</dt>
            <dd className="min-w-0 truncate text-[11px] font-medium text-slate-100">{value}</dd>
          </div>
        ))}
      </dl>
      {href && cta ? (
        <Link href={href} className="mt-2 inline-flex h-7 items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
          {cta}
        </Link>
      ) : null}
    </section>
  );
}

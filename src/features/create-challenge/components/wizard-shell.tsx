import type { ReactNode } from "react";
import { WizardSidebar } from "./wizard-sidebar";

type WizardShellProps = {
  children: ReactNode;
};

export function WizardShell({ children }: WizardShellProps) {
  return (
    <main className="min-h-screen bg-[#030a1f] text-white">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-10 sm:px-8 lg:grid-cols-[320px_1fr] lg:px-10">
        <WizardSidebar />
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-6 shadow-2xl shadow-slate-950/40">
          {children}
        </div>
      </div>
    </main>
  );
}

import { StatusPill } from "@/components/ui/status-pill";
import { validationItems } from "@/features/landing/data/site";

export function NetworkPanel() {
  return (
    <aside className="rounded-lg border border-stone-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-stone-500">Network status</p>
          <h3 className="mt-2 text-xl font-semibold text-stone-950">
            Arc testnet path
          </h3>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          Verified
        </span>
      </div>

      <dl className="mt-6 grid gap-4 text-sm">
        <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3">
          <dt className="text-stone-500">Wallet provider</dt>
          <dd className="font-medium text-stone-950">Circle Wallets</dd>
        </div>
        <div className="flex items-center justify-between gap-4 border-b border-stone-100 pb-3">
          <dt className="text-stone-500">Blockchain</dt>
          <dd className="font-medium text-stone-950">ARC-TESTNET</dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-stone-500">Asset</dt>
          <dd className="font-medium text-stone-950">Test USDC</dd>
        </div>
      </dl>

      <div className="mt-6 space-y-3">
        {validationItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-4 rounded-md border border-stone-100 px-3 py-2"
          >
            <span className="text-sm text-stone-700">{item.label}</span>
            <StatusPill status={item.status} />
          </div>
        ))}
      </div>
    </aside>
  );
}

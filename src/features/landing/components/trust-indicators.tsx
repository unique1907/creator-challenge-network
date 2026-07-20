import { trustIndicators } from "@/features/landing/data/landing-page";
import { LandingIcon } from "./landing-icons";

export function TrustIndicators() {
  return (
    <div className="grid grid-cols-2 gap-3 pt-6 sm:grid-cols-4">
      {trustIndicators.map((item) => (
        <div key={item.title} className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-300/20 bg-blue-400/10 text-cyan-200">
            <LandingIcon name={item.icon} className="h-[18px] w-[18px]" />
          </span>
          <span>
            <span className="block text-xs font-semibold text-white">
              {item.title}
            </span>
            <span className="mt-1 block text-[11px] leading-4 text-slate-400">
              {item.description}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}

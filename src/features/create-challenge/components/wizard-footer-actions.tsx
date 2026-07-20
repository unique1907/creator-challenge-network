import Link from "next/link";

type WizardFooterActionsProps = {
  primaryLabel?: string;
  secondaryHref?: string;
  secondaryLabel?: string;
};

export function WizardFooterActions({
  primaryLabel = "Continue",
  secondaryHref = "/",
  secondaryLabel = "Back to home",
}: WizardFooterActionsProps) {
  return (
    <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
      <Link
        href={secondaryHref}
        className="inline-flex h-11 items-center justify-center rounded-md border border-white/15 bg-white/5 px-5 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-200"
      >
        {secondaryLabel}
      </Link>
      <button
        type="button"
        disabled
        className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-md bg-gradient-to-r from-blue-500 to-violet-600 px-5 text-sm font-bold text-white opacity-70"
      >
        {primaryLabel}
      </button>
    </div>
  );
}

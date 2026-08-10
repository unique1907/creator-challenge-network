type LiveStatusBadgeProps = {
  className?: string;
};

export function LiveStatusBadge({ className = "" }: LiveStatusBadgeProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700 ${className}`}
    >
      Live
    </span>
  );
}

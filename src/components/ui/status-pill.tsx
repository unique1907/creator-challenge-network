import { statusClassName, statusLabel } from "@/utils/status";
import type { ValidationItem } from "@/types/ccn";

type StatusPillProps = {
  status: ValidationItem["status"];
};

export function StatusPill({ status }: StatusPillProps) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-full border px-3 text-xs font-semibold ${statusClassName(status)}`}
    >
      {statusLabel(status)}
    </span>
  );
}

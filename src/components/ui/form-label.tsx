import type { ReactNode } from "react";

type FormLabelProps = {
  children: ReactNode;
  required?: boolean;
  optional?: boolean;
  readOnly?: boolean;
  className?: string;
};

export function FormLabel({
  children,
  required = false,
  optional = false,
  readOnly = false,
  className = "",
}: FormLabelProps) {
  if (process.env.NODE_ENV !== "production" && required && optional) {
    throw new Error("FormLabel cannot be both required and optional.");
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 text-sm font-bold text-slate-200 ${className}`}>
      <span>{children}</span>
      {required ? (
        <>
          <span aria-hidden="true" className="text-rose-300">
            *
          </span>
          <span className="sr-only"> required</span>
        </>
      ) : null}
      {optional ? <span className="text-xs font-semibold text-slate-400">(Optional)</span> : null}
      {readOnly ? (
        <span className="rounded-full border border-white/10 bg-white/[0.05] px-2 py-0.5 text-[10px] font-black uppercase tracking-[0.14em] text-slate-300">
          Read only
        </span>
      ) : null}
    </span>
  );
}

export type CreateChallengeTraceSource =
  | "step-enter"
  | "explicit-click"
  | "effect"
  | "retry"
  | "approval-precheck"
  | "restore"
  | "server"
  | "rpc";

export type CreateChallengeTraceEvent = {
  requestId: string;
  route: string;
  functionName?: string;
  draftId?: string;
  currentStep?: string;
  triggerSource: CreateChallengeTraceSource;
  startedAt?: string;
  completedAt?: string;
  success?: boolean;
  status?: number | string;
  attemptedErrorUpdate?: boolean;
  accepted?: boolean;
  stale?: boolean;
  message?: string;
};

export function createChallengeTraceId(prefix = "ccn") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isCreateChallengeTraceEnabled() {
  return process.env.NODE_ENV !== "production";
}

export function logCreateChallengeTrace(event: CreateChallengeTraceEvent) {
  if (!isCreateChallengeTraceEnabled()) return;
  const safeEvent = { ...event };
  if (typeof window !== "undefined") {
    const target = window as typeof window & { __CCN_PAYMENT_TRACE__?: CreateChallengeTraceEvent[] };
    target.__CCN_PAYMENT_TRACE__ = [...(target.__CCN_PAYMENT_TRACE__ ?? []), safeEvent];
  }
  console.info("[ccn-payment-trace]", JSON.stringify(safeEvent));
}

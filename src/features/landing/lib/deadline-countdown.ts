export function formatDeadlineDateLabel(deadline: string) {
  const parsed = Date.parse(deadline);
  if (!Number.isFinite(parsed)) return deadline;
  return new Date(parsed).toISOString().slice(0, 10);
}

export function remainingDeadlineDurationLabel(deadline: string, nowIso: string) {
  const deadlineMs = Date.parse(deadline);
  const nowMs = Date.parse(nowIso);
  if (!Number.isFinite(deadlineMs) || !Number.isFinite(nowMs)) return null;

  const remainingMs = deadlineMs - nowMs;
  if (remainingMs <= 0) return null;

  const totalMinutes = Math.floor(remainingMs / 60000);
  if (totalMinutes <= 0) return "0m";

  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const paddedMinutes = String(minutes).padStart(2, "0");

  if (days > 0) return `${days}d ${hours}h ${paddedMinutes}m`;
  if (hours > 0) return `${hours}h ${paddedMinutes}m`;
  return `${minutes}m`;
}

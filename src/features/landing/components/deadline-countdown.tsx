"use client";

import { useEffect, useState } from "react";
import { remainingDeadlineDurationLabel } from "@/features/landing/lib/deadline-countdown";

type DeadlineCountdownProps = {
  deadline: string;
  initialNowIso: string;
};

export function DeadlineCountdown({ deadline, initialNowIso }: DeadlineCountdownProps) {
  const [nowIso, setNowIso] = useState(initialNowIso);
  const label = remainingDeadlineDurationLabel(deadline, nowIso);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowIso(new Date().toISOString());
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  return label;
}

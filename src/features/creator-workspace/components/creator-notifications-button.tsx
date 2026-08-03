"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { CreatorNotificationItem } from "@/services/creator-workspace/creator-workspace.server";

export function CreatorNotificationsButton({ notifications }: { notifications: CreatorNotificationItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const unreadCount = notifications.filter((item) => item.unread).length;

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label="Open Creator notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-200 transition hover:bg-white/[0.08] focus:outline-none focus:ring-2 focus:ring-violet-300/60"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-violet-600 px-1 text-[11px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 z-50 mt-3 w-[320px] overflow-hidden rounded-2xl border border-white/10 bg-[#080d18] shadow-2xl shadow-black/40">
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
            <p className="text-sm font-semibold text-white">Notifications</p>
            <Link href="/dashboard/creator/notifications" onClick={() => setOpen(false)} className="text-xs font-semibold text-violet-300 hover:text-violet-200">
              View all
            </Link>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {notifications.length ? notifications.slice(0, 5).map((item) => (
              <Link key={item.id} role="menuitem" href={item.href} onClick={() => setOpen(false)} className="grid grid-cols-[36px_minmax(0,1fr)_auto] gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/[0.06]">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet-500/15 text-xs font-bold text-violet-100" aria-hidden="true">{item.iconLabel}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold text-white">{item.headline}</span>
                  <span className="mt-1 line-clamp-2 block text-xs leading-5 text-slate-400">{item.message}</span>
                </span>
                <span className="flex flex-col items-end gap-2 text-xs text-slate-500">
                  {item.timeLabel}
                  {item.unread ? <span className="h-2 w-2 rounded-full bg-violet-400" aria-label="Unread" /> : null}
                </span>
              </Link>
            )) : (
              <div className="px-3 py-5 text-sm text-slate-400">
                <p className="font-semibold text-white">No notifications yet</p>
                <p className="mt-1">Submission, review, winner and payout events will appear here.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

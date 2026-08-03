"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BrandDashboardNotification } from "@/features/dashboard/brand-dashboard-view-model";

const NOTIFICATION_READ_STORAGE_KEY = "ccn:brand-notification-read:v1";
const NOTIFICATION_READ_STORAGE_EVENT = "ccn:brand-notification-read-updated";

function readStoredNotificationIdList() {
  if (typeof window === "undefined") return [] as string[];
  try {
    const stored = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    const ids = stored ? JSON.parse(stored) : [];
    return Array.isArray(ids) ? ids.filter((item) => typeof item === "string").sort() : [];
  } catch {
    return [] as string[];
  }
}

function readStoredNotificationIds() {
  return new Set<string>(readStoredNotificationIdList());
}

function notificationReadSnapshot() {
  return JSON.stringify(readStoredNotificationIdList());
}

function subscribeNotificationReadStore(callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  function notifyStorageChange(event: StorageEvent) {
    if (event.key === NOTIFICATION_READ_STORAGE_KEY) callback();
  }
  window.addEventListener("storage", notifyStorageChange);
  window.addEventListener(NOTIFICATION_READ_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", notifyStorageChange);
    window.removeEventListener(NOTIFICATION_READ_STORAGE_EVENT, callback);
  };
}

export type BrandAccountMenuProps = {
  displayName: string;
  brandName?: string | null;
  email?: string;
  workspaceLabel: string;
  creatorAccess?: boolean;
  avatarImageUrl?: string | null;
};

export function AiTemplatesBetaButton() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        panelRef.current &&
        triggerRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="ai-templates-beta-panel"
        onClick={() => setOpen((value) => !value)}
        className="flex h-11 w-full items-center gap-3 rounded-lg px-4 text-left text-slate-300 transition hover:bg-white/[0.04] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
      >
        <span className="grid h-5 w-5 place-items-center rounded border border-white/15 text-[10px]">AI</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span>AI Templates</span>
          <span className="rounded border border-violet-300/40 bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-violet-100">
            Beta
          </span>
        </span>
      </button>
      {open ? (
        <div
          ref={panelRef}
          id="ai-templates-beta-panel"
          role="dialog"
          aria-label="AI Templates Beta"
          className="absolute left-0 top-12 z-50 w-72 rounded-xl border border-white/10 bg-[#0b1220] p-4 text-sm shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-2">
            <p className="font-black text-white">AI Templates</p>
            <span className="rounded border border-violet-300/40 bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em] text-violet-100">
              Beta
            </span>
          </div>
          <p className="mt-3 leading-6 text-slate-300">
            Create stronger campaign briefs and launch-ready drafts with an AI assistant. This feature is currently in development.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-400">
            Soon, AI Templates will help structure campaign goals, prizes, timelines, and review criteria.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BrandNotifications({ notifications }: { notifications: BrandDashboardNotification[] }) {
  const [open, setOpen] = useState(false);
  const readNotificationSnapshot = useSyncExternalStore(subscribeNotificationReadStore, notificationReadSnapshot, () => "[]");
  const readNotificationIds = new Set<string>(JSON.parse(readNotificationSnapshot) as string[]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const actionCount = notifications.filter((item) => item.statusLabel === "Needs action").length;
  const unreadCount = notifications.filter((item) => item.unread && !readNotificationIds.has(item.id)).length;

  function markNotificationRead(id: string) {
    const next = readStoredNotificationIds();
    next.add(id);
    try {
      window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(Array.from(next).sort()));
      window.setTimeout(() => window.dispatchEvent(new Event(NOTIFICATION_READ_STORAGE_EVENT)), 0);
    } catch {
      // Read state is a UI affordance; navigation should still work if storage is unavailable.
    }
  }

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (
        panelRef.current &&
        triggerRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Open Action Center: ${unreadCount} unread Brand notifications, ${actionCount} actions need attention`}
        title="Open Action Center"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-[68px] w-[68px] place-items-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-violet-300/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17H9m9-2.5V11a6 6 0 0 0-12 0v3.5L4.5 17h15L18 14.5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20a2.25 2.25 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {unreadCount ? (
          <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-black text-white">
            {unreadCount}
          </span>
        ) : actionCount ? (
          <span className="absolute right-3 top-3 grid h-5 min-w-5 place-items-center rounded-full bg-violet-500 px-1 text-[10px] font-black text-white">
            {actionCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Brand notifications"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(420px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="text-sm font-black text-white">Action Center</p>
            <p className="mt-1 text-xs text-slate-400">Derived from current campaign state.</p>
          </div>
          <div className="max-h-[360px] overflow-y-auto p-2">
            {notifications.length ? notifications.map((item) => {
              const unread = Boolean(item.unread && !readNotificationIds.has(item.id));
              return (
                <a
                  key={item.id}
                  role="menuitem"
                  href={item.href}
                  onClick={() => markNotificationRead(item.id)}
                  className="block rounded-lg px-3 py-3 transition hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none"
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="min-w-0 text-sm font-bold leading-5 text-white">{item.title}</span>
                    <span className={`shrink-0 rounded border px-2 py-1 text-[10px] font-black uppercase tracking-[0.1em] ${
                      unread
                        ? "border-red-300/40 bg-red-400/15 text-red-100"
                        : "border-violet-300/30 bg-violet-400/10 text-violet-100"
                    }`}>
                      {unread ? "Unread" : item.statusLabel}
                    </span>
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-400">{item.campaignName}</span>
                  {item.metadata ? <span className="mt-1 block text-xs font-bold leading-5 text-cyan-200">{item.metadata}</span> : null}
                  {item.ctaLabel ? <span className="mt-2 block text-xs font-black uppercase tracking-[0.12em] text-blue-200">{item.ctaLabel}</span> : null}
                </a>
              );
            }) : (
              <p className="px-3 py-4 text-sm text-slate-400">No campaign actions are waiting.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BrandAccountMenu({ displayName, brandName, email, workspaceLabel, avatarImageUrl }: BrandAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeName = displayName?.trim() || "Brand Account";
  const safeBrandName = brandName?.trim() || "Brand name not set";

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => {
      document.removeEventListener("keydown", closeOnEscape);
      document.removeEventListener("mousedown", closeOnOutsideClick);
    };
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] p-4 text-left transition hover:border-violet-300/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60"
      >
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-full bg-slate-800 text-xs font-black">
            {avatarImageUrl ? <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">CCN</span>}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white">{safeName}</p>
            <p className="mt-1 truncate text-xs text-slate-400">{safeBrandName}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">{workspaceLabel}</p>
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Brand account menu"
          className="absolute bottom-[calc(100%+10px)] left-0 z-50 w-full overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">{safeName}</p>
            <p className="mt-1 truncate text-xs text-slate-300">{safeBrandName}</p>
            {email ? <p className="mt-1 truncate text-xs text-slate-400">{email}</p> : null}
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{workspaceLabel}</p>
          </div>
          <Link role="menuitem" href="/dashboard" className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Brand Workspace
          </Link>
          <Link role="menuitem" href="/dashboard/settings/profile" className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Brand Profile
          </Link>
          <Link role="menuitem" href="/dashboard/settings/company" className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Company Settings
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white focus:outline-none"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

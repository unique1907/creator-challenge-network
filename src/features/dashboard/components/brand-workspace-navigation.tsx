"use client";

/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { BrandDashboardNotification } from "@/features/dashboard/brand-dashboard-view-model";

const NOTIFICATION_READ_STORAGE_KEY = "ccn:brand-notifications-read:v1";
const NOTIFICATION_READ_STORAGE_EVENT = "ccn:brand-notification-read-updated";

function notificationStorageKey(accountKey: string) {
  const normalized = accountKey.trim().toLowerCase() || "anonymous-brand";
  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }
  const scope = `brand-${hash.toString(36)}`;
  return `${NOTIFICATION_READ_STORAGE_KEY}:${scope}`;
}

function readStoredNotificationIdList(accountKey: string, visibleIds?: Set<string>) {
  if (typeof window === "undefined") return [] as string[];
  try {
    const stored = window.localStorage.getItem(notificationStorageKey(accountKey));
    const ids = stored ? JSON.parse(stored) : [];
    return Array.isArray(ids)
      ? ids
        .filter((item) => typeof item === "string")
        .filter((item) => !visibleIds || visibleIds.has(item))
        .sort()
      : [];
  } catch {
    return [] as string[];
  }
}

function readStoredNotificationIds(accountKey: string, visibleIds?: Set<string>) {
  return new Set<string>(readStoredNotificationIdList(accountKey, visibleIds));
}

function notificationReadSnapshot(accountKey: string, visibleIds?: Set<string>) {
  return JSON.stringify(readStoredNotificationIdList(accountKey, visibleIds));
}

function subscribeNotificationReadStore(accountKey: string, callback: () => void) {
  if (typeof window === "undefined") return () => undefined;
  function notifyStorageChange(event: StorageEvent) {
    if (event.key === notificationStorageKey(accountKey)) callback();
  }
  window.addEventListener("storage", notifyStorageChange);
  window.addEventListener(NOTIFICATION_READ_STORAGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", notifyStorageChange);
    window.removeEventListener(NOTIFICATION_READ_STORAGE_EVENT, callback);
  };
}

function writeStoredNotificationIds(accountKey: string, ids: Set<string>) {
  window.localStorage.setItem(notificationStorageKey(accountKey), JSON.stringify(Array.from(ids).sort()));
  window.dispatchEvent(new Event(NOTIFICATION_READ_STORAGE_EVENT));
}

export type BrandAccountMenuProps = {
  displayName: string;
  brandName?: string | null;
  email?: string;
  workspaceLabel: string;
  creatorAccess?: boolean;
  avatarImageUrl?: string | null;
  variant?: "sidebar" | "topbar";
};

export type BrandAccountControlsProps = {
  displayName: string;
  brandName?: string | null;
  email?: string;
  workspaceLabel?: string;
  creatorAccess?: boolean;
  avatarImageUrl?: string | null;
  notifications: BrandDashboardNotification[];
};

export function AiTemplatesBetaButton({ variant = "default" }: { variant?: "default" | "compact" }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const compact = variant === "compact";

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
        className={`${compact ? "h-8 rounded-md border border-transparent px-2.5 text-[12px] font-medium hover:bg-white/[0.05]" : "h-9 rounded-lg px-3"} flex w-full items-center gap-2 text-left text-slate-300 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60`}
      >
        <span className={`${compact ? "h-6 w-6" : "h-5 w-5"} grid place-items-center rounded border border-white/15 text-[10px]`}>AI</span>
        <span className="flex min-w-0 flex-1 items-center justify-between gap-1.5 whitespace-nowrap">
          <span className="whitespace-nowrap">AI Templates</span>
          <span className="shrink-0 rounded border border-violet-300/40 bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-violet-100">
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
          className="absolute left-0 top-10 z-50 w-64 rounded-xl border border-white/10 bg-[#0b1220] p-3 text-[12px] shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-2">
            <p className="font-semibold text-white">AI Templates</p>
            <span className="rounded border border-violet-300/40 bg-violet-400/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-violet-100">
              Beta
            </span>
          </div>
          <p className="mt-2 leading-5 text-slate-300">
            Create stronger business challenge briefs and launch-ready drafts with an AI assistant. This feature is currently in development.
          </p>
          <p className="mt-2 text-[11px] leading-4 text-slate-400">
            Soon, AI Templates will help structure business goals, prizes, timelines, and review criteria.
          </p>
        </div>
      ) : null}
    </div>
  );
}

export function BrandNotifications({ notifications, accountKey }: { notifications: BrandDashboardNotification[]; accountKey: string }) {
  const [open, setOpen] = useState(false);
  const visibleNotificationIds = new Set(notifications.map((item) => item.id));
  const readNotificationSnapshot = useSyncExternalStore(
    (callback) => subscribeNotificationReadStore(accountKey, callback),
    () => notificationReadSnapshot(accountKey, visibleNotificationIds),
    () => "[]",
  );
  const readNotificationIds = new Set<string>(JSON.parse(readNotificationSnapshot) as string[]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const actionCount = notifications.filter((item) => item.statusLabel === "Needs action").length;
  const unreadCount = notifications.filter((item) => item.unread && !readNotificationIds.has(item.id)).length;

  function markNotificationRead(id: string) {
    const next = readStoredNotificationIds(accountKey, visibleNotificationIds);
    next.add(id);
    try {
      writeStoredNotificationIds(accountKey, next);
    } catch {
      // Read state is a UI affordance; navigation should still work if storage is unavailable.
    }
  }

  function markVisibleUnreadNotificationsRead() {
    const unreadIds = notifications
      .filter((item) => item.unread && !readNotificationIds.has(item.id))
      .map((item) => item.id);
    if (unreadIds.length === 0) return;
    const next = readStoredNotificationIds(accountKey, visibleNotificationIds);
    for (const id of unreadIds) next.add(id);
    try {
      writeStoredNotificationIds(accountKey, next);
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
        onClick={() => {
          if (!open) markVisibleUnreadNotificationsRead();
          setOpen((value) => !value);
        }}
        className={`relative grid h-9 w-9 place-items-center rounded-lg border bg-white/[0.03] text-slate-200 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60 ${
          unreadCount > 0
            ? "border-red-400/45 hover:border-red-300/70"
            : "border-white/10 hover:border-violet-300/30"
        }`}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17H9m9-2.5V11a6 6 0 0 0-12 0v3.5L4.5 17h15L18 14.5Z" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20a2.25 2.25 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {unreadCount ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[9px] font-semibold text-white">
            {unreadCount}
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          ref={panelRef}
          role="menu"
          aria-label="Brand notifications"
          className="absolute right-0 top-[calc(100%+10px)] z-50 w-[min(384px,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-3.5 py-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-base font-semibold leading-5 text-white">Action Center</p>
              {unreadCount > 0 ? (
                <span className="rounded-full border border-red-300/35 bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-red-100">
                  {unreadCount} unread
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-300">
                  All caught up
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[12px] leading-4 text-slate-400">Based on live Brand Workspace activity.</p>
          </div>
          <div className="max-h-[340px] space-y-2 overflow-y-auto p-3">
            {notifications.length ? notifications.map((item) => {
              const unread = Boolean(item.unread && !readNotificationIds.has(item.id));
              return (
                <a
                  key={item.id}
                  role="menuitem"
                  href={item.href}
                  onClick={() => markNotificationRead(item.id)}
                  className={`block rounded-lg border px-3 py-2 transition hover:bg-white/[0.06] focus:bg-white/[0.06] focus:outline-none ${
                    unread
                      ? "border-red-300/20 bg-red-500/[0.055]"
                      : "border-white/5 bg-white/[0.02]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-2">
                      {unread ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" aria-hidden="true" /> : null}
                      <span className={`min-w-0 text-[13px] font-semibold leading-4 ${unread ? "text-white" : "text-slate-300"}`}>{item.title}</span>
                    </span>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] ${
                      unread
                        ? "border-red-300/40 bg-red-400/15 text-red-100"
                        : "border-white/10 bg-white/[0.04] text-slate-300"
                    }`}>
                      {unread ? "Unread" : "Read"}
                    </span>
                  </span>
                  <span className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span className="rounded border border-violet-300/30 bg-violet-400/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-violet-100">
                      {item.statusLabel}
                    </span>
                    {item.ctaLabel ? <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-blue-200">{item.ctaLabel}</span> : null}
                  </span>
                  <span className="mt-1 block text-[12px] leading-4 text-slate-400">{item.campaignName}</span>
                  {item.metadata ? <span className="mt-0.5 block text-[11px] font-medium leading-4 text-cyan-200">{item.metadata}</span> : null}
                </a>
              );
            }) : (
              <p className="px-3 py-3 text-[12px] leading-4 text-slate-400">No business challenge actions are waiting.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function BrandAccountControls({
  displayName,
  brandName,
  email,
  workspaceLabel = "Brand Workspace",
  creatorAccess,
  avatarImageUrl,
  notifications,
}: BrandAccountControlsProps) {
  const profileName = displayName?.trim() || "Brand Account";

  return (
    <div data-brand-account-controls className="flex shrink-0 items-center gap-2">
      <BrandNotifications notifications={notifications} accountKey={email ?? profileName} />
      <BrandAccountMenu
        variant="topbar"
        displayName={profileName}
        brandName={brandName}
        email={email}
        workspaceLabel={workspaceLabel}
        creatorAccess={creatorAccess}
        avatarImageUrl={avatarImageUrl}
      />
    </div>
  );
}

export function BrandAccountMenu({ displayName, brandName, email, workspaceLabel, avatarImageUrl, variant = "sidebar" }: BrandAccountMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeName = displayName?.trim() || email?.trim() || "Account";
  const realBrandName = brandName?.trim() || null;
  const primaryIdentity = realBrandName || safeName;
  const secondaryIdentity = email?.trim() || null;
  const avatarFallback = primaryIdentity
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("") || "B";
  const topbar = variant === "topbar";

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
        className={`${topbar ? "flex h-9 items-center gap-1.5 rounded-lg border-transparent bg-transparent px-1 py-0" : "w-full rounded-xl border-white/10 bg-white/[0.03] p-2.5 text-left"} border transition hover:border-violet-300/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/60`}
      >
        <div className="flex items-center gap-2">
          <div className={`${topbar ? "h-8 w-8" : "h-9 w-9"} overflow-hidden rounded-full bg-violet-700 text-[11px] font-semibold text-white`}>
            {avatarImageUrl ? <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center">{avatarFallback}</span>}
          </div>
          {topbar ? (
            <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4 w-4 text-slate-400" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08Z" clipRule="evenodd" />
            </svg>
          ) : (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">{primaryIdentity}</p>
              {secondaryIdentity ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{secondaryIdentity}</p> : null}
            </div>
          )}
        </div>
        {topbar ? null : <p className="mt-2 text-[11px] text-slate-500">{workspaceLabel}</p>}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label="Brand account menu"
          className={`${topbar ? "absolute right-0 top-[calc(100%+8px)] w-64" : "absolute bottom-[calc(100%+8px)] left-0 w-full"} z-50 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] shadow-2xl shadow-black/40`}
        >
          <div className="border-b border-white/10 px-3 py-2">
            <p className="truncate text-[12px] font-semibold text-white">{primaryIdentity}</p>
            {secondaryIdentity ? <p className="mt-0.5 truncate text-[11px] text-slate-300">{secondaryIdentity}</p> : null}
            {email && secondaryIdentity !== email ? <p className="mt-0.5 truncate text-[11px] text-slate-400">{email}</p> : null}
            <p className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-cyan-200">{workspaceLabel}</p>
          </div>
          <Link role="menuitem" href="/dashboard" className="block px-3 py-2 text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Brand Workspace
          </Link>
          <Link role="menuitem" href="/dashboard/settings/profile" className="block px-3 py-2 text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Profile
          </Link>
          <Link role="menuitem" href="/dashboard/settings" className="block px-3 py-2 text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Settings
          </Link>
          <Link role="menuitem" href="/dashboard/settings/company" className="block px-3 py-2 text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white">
            Company Settings
          </Link>
          <form action="/auth/sign-out" method="post">
            <button
              type="submit"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white focus:bg-white/[0.06] focus:text-white focus:outline-none"
            >
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}

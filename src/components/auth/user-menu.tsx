/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type UserMenuProps = {
  displayName?: string;
  email?: string;
  workspaceLabel: string;
  initials: string;
  avatarUrl?: string | null;
  className?: string;
};

export function UserMenu({ displayName, email, workspaceLabel, initials, avatarUrl, className = "" }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const safeName = displayName?.trim() || email?.trim() || "CCN account";
  const safeInitials = initials.trim().slice(0, 3).toUpperCase() || "CCN";

  useEffect(() => {
    if (!open) return;

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function closeOnOutsideClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
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
    <div ref={menuRef} className={`relative ${className}`}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${workspaceLabel} account menu`}
        onClick={() => setOpen((value) => !value)}
        className="grid h-12 w-12 place-items-center overflow-hidden rounded-full bg-violet-700 text-sm font-bold text-white outline-none ring-blue-300/40 transition hover:bg-violet-600 focus-visible:ring-2"
      >
        {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : safeInitials}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={`${workspaceLabel} account menu`}
          className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-xl border border-white/10 bg-[#0b1220] text-left shadow-2xl shadow-black/40"
        >
          <div className="border-b border-white/10 px-4 py-3">
            <p className="truncate text-sm font-semibold text-white">{safeName}</p>
            {email && email !== safeName ? <p className="mt-1 truncate text-xs text-slate-400">{email}</p> : null}
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">{workspaceLabel}</p>
          </div>
          {workspaceLabel === "Creator Workspace" ? (
            <>
              <Link
                role="menuitem"
                href="/dashboard/creator"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Creator Dashboard
              </Link>
              <Link
                role="menuitem"
                href="/dashboard/creator/profile"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Profile
              </Link>
              <Link
                role="menuitem"
                href="/dashboard/creator/wallet"
                onClick={() => setOpen(false)}
                className="block px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06] hover:text-white"
              >
                Wallet
              </Link>
            </>
          ) : null}
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

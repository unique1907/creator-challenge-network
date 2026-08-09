"use client";

import { useMemo, useState } from "react";
import { FormLabel } from "@/components/ui/form-label";
import type { AuthIntentRole } from "./auth-actions";
import { AuthActions } from "./auth-actions";

const roles: Array<{
  id: AuthIntentRole;
  label: string;
  description: string;
  nextPath: string;
}> = [
  {
    id: "brand",
    label: "Brand",
    description: "Launch creative challenges, fund prize pools, review ideas, and select winners.",
    nextPath: "/dashboard",
  },
  {
    id: "creator",
    label: "Creator",
    description: "Discover challenges, submit creative work, and receive rewards when selected.",
    nextPath: "/dashboard/creator",
  },
];

function titleForRole(role: AuthIntentRole) {
  return role === "brand" ? "Create your Brand account" : "Create your Creator account";
}

function safeRoleNextPath(role: AuthIntentRole, nextPath?: string | null) {
  if (!nextPath || !nextPath.startsWith("/") || nextPath.startsWith("//")) {
    return roles.find((item) => item.id === role)?.nextPath ?? "/dashboard";
  }
  if (role === "creator" && nextPath.startsWith("/dashboard/creator")) return nextPath;
  if (role === "brand" && (nextPath === "/dashboard" || nextPath.startsWith("/dashboard/"))) return nextPath;
  return roles.find((item) => item.id === role)?.nextPath ?? "/dashboard";
}

export function SignUpEntry({ initialRole, nextPath }: { initialRole: AuthIntentRole | null; nextPath?: string | null }) {
  const [selectedRole, setSelectedRole] = useState<AuthIntentRole | null>(initialRole);
  const selected = useMemo(
    () => roles.find((role) => role.id === selectedRole) ?? null,
    [selectedRole],
  );

  return (
    <section className="mt-7" aria-labelledby="role-selection-title">
      <h1 id="role-selection-title" className="text-3xl font-semibold text-white">
        Create your account
      </h1>
      <p className="mt-3 text-slate-300">
        Choose one primary role for this account. Use a separate sign-in for the other role.
      </p>
      <p className="mt-5 text-sm font-semibold text-slate-200">
        <FormLabel required>Account type</FormLabel>
      </p>
      <div role="radiogroup" aria-label="Choose a required CCN primary role" aria-required="true" className="mt-3 grid gap-4 md:grid-cols-2">
        {roles.map((role) => {
          const active = selectedRole === role.id;
          return (
            <button
              key={role.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setSelectedRole(role.id)}
              className={`min-h-44 rounded-2xl border p-5 text-left transition focus:outline-none focus:ring-2 focus:ring-cyan-200 ${
                active
                  ? "border-cyan-300/60 bg-cyan-400/10 shadow-lg shadow-cyan-950/20"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span className="text-xl font-semibold text-white">{role.label}</span>
              <span className="mt-4 block text-sm leading-6 text-slate-300">{role.description}</span>
              <span className={`mt-5 inline-flex rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] ${
                active ? "bg-cyan-300 text-slate-950" : "bg-white/10 text-slate-300"
              }`}>
                {active ? "Selected" : "Select"}
              </span>
            </button>
          );
        })}
      </div>
      {selected ? (
        <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">Selected workspace</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">
            {titleForRole(selected.id)}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            {selected.description} This becomes the primary role for this account after onboarding. Use a separate sign-in for the other role.
          </p>
        </div>
      ) : null}
      <AuthActions
        mode="sign-up"
        roleIntent={selected?.id ?? null}
        nextPath={selected ? safeRoleNextPath(selected.id, nextPath) : null}
      />
    </section>
  );
}

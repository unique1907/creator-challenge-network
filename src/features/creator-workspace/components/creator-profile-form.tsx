/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { FormLabel } from "@/components/ui/form-label";

type CreatorProfileFormProps = {
  initialDisplayName: string;
  initialUsername: string;
  initialCountry: string;
  initialAvatarImageKey: string | null;
  initialAvatarImageUrl: string | null;
};

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function CreatorProfileForm(props: CreatorProfileFormProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(props.initialDisplayName);
  const [username, setUsername] = useState(props.initialUsername);
  const [country, setCountry] = useState(props.initialCountry);
  const [avatarImageKey, setAvatarImageKey] = useState<string | null>(props.initialAvatarImageKey);
  const [avatarImageUrl, setAvatarImageUrl] = useState<string | null>(props.initialAvatarImageUrl);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedUsername = useMemo(() => normalizeUsername(username), [username]);
  const usernameLooksValid = /^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$/.test(normalizedUsername);
  const initials = (displayName.trim() || username.trim() || "CCN").slice(0, 2).toUpperCase();

  async function uploadAvatar(file: File) {
    setUploading(true);
    setStatus("");
    setError("");
    try {
      const form = new FormData();
      form.set("type", "avatar");
      form.set("file", file);
      const response = await fetch("/api/creator/identity-media", {
        method: "POST",
        body: form,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message ?? "Creator avatar upload failed.");
      if (!data?.image?.imageKey || !data?.image?.imageUrl) throw new Error("Creator avatar upload did not return a persisted image reference.");
      setAvatarImageKey(data.image?.imageKey ?? null);
      setAvatarImageUrl(data.image?.imageUrl ?? null);
      setStatus("Avatar uploaded. Save profile to make it visible across your workspace.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Creator avatar upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function saveProfile() {
    setPending(true);
    setStatus("");
    setError("");
    try {
      const response = await fetch("/api/creator/profile", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ displayName, username, country, avatarImageKey }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error?.message ?? "Creator profile update failed.");
      const profile = data?.profile;
      if (!profile) throw new Error("Creator profile update did not return a verified profile.");
      setDisplayName(profile.displayName ?? displayName.trim());
      setUsername(profile.username ?? normalizedUsername);
      setCountry(profile.country ?? "");
      setAvatarImageKey(profile.avatarImageKey ?? null);
      setAvatarImageUrl(profile.avatarImageUrl ?? null);
      setStatus("Creator profile saved.");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Creator profile update failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-3 grid gap-2.5">
      <div className="rounded-xl border border-white/10 bg-[#070b14] p-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-blue-600 to-violet-700 text-sm font-semibold text-white">
            {avatarImageUrl ? <img src={avatarImageUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </div>
          <div className="min-w-0 flex-1">
            <FormLabel optional>Avatar</FormLabel>
            <p className="mt-0.5 text-[11px] text-slate-400">JPG, PNG or WebP. Used in your Creator Workspace profile surfaces.</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadAvatar(file);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || pending}
              className="rounded-md border border-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {avatarImageUrl ? "Replace photo" : "Upload photo"}
            </button>
            {avatarImageUrl ? (
              <button
                type="button"
                onClick={() => {
                  setAvatarImageKey(null);
                  setAvatarImageUrl(null);
                  setStatus("Avatar removed. Save profile to update your workspace.");
                  setError("");
                }}
                disabled={uploading || pending}
                className="rounded-md border border-white/10 px-2.5 py-1.5 text-[12px] font-semibold text-slate-200 transition hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Remove photo
              </button>
            ) : null}
          </div>
        </div>
      </div>
      <label className="grid gap-1 text-[12px] font-medium text-slate-200">
        <FormLabel required>Display name</FormLabel>
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          required
          aria-required="true"
          className="h-8 rounded-md border border-white/10 bg-[#050916] px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <label className="grid gap-1 text-[12px] font-medium text-slate-200">
        <FormLabel required>Username</FormLabel>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          required
          aria-required="true"
          className="h-8 rounded-md border border-white/10 bg-[#050916] px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-300/60"
        />
        <span className={usernameLooksValid ? "text-xs text-emerald-300" : "text-xs text-amber-300"}>
          {usernameLooksValid ? `Will save as @${normalizedUsername}` : "Use 3-30 letters, numbers, dots, underscores or hyphens."}
        </span>
      </label>
      <label className="grid gap-1 text-[12px] font-medium text-slate-200">
        <FormLabel optional>Country</FormLabel>
        <input
          value={country}
          onChange={(event) => setCountry(event.target.value)}
          className="h-8 rounded-md border border-white/10 bg-[#050916] px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-300/60"
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void saveProfile()}
          disabled={pending || uploading || !usernameLooksValid}
          className="rounded-md bg-violet-600 px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Saving..." : uploading ? "Uploading..." : "Save profile"}
        </button>
        {status ? <p className="text-[12px] text-emerald-200">{status}</p> : null}
        {error ? <p className="text-[12px] text-rose-200">{error}</p> : null}
      </div>
    </div>
  );
}

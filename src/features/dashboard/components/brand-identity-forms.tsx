"use client";

/* eslint-disable @next/next/no-img-element */
import { useState, type ChangeEvent, type FormEvent } from "react";
import { FormLabel } from "@/components/ui/form-label";

type AccountImage = { imageKey: string | null; imageUrl: string | null };

async function parseJson<T>(response: Response): Promise<T> {
  const json = await response.json();
  if (!response.ok) throw new Error(json?.error?.message ?? "Request failed safely.");
  return json as T;
}

async function uploadIdentityImage(input: {
  type: "avatar" | "brand-logo";
  file: File;
  previousKey?: string | null;
}) {
  const form = new FormData();
  form.set("type", input.type);
  form.set("file", input.file);
  if (input.previousKey) form.set("previousKey", input.previousKey);
  const response = await fetch("/api/dashboard/identity-media", { method: "POST", body: form });
  return parseJson<{ image: { imageKey: string; imageUrl: string } }>(response);
}

export function BrandProfileForm({
  initialDisplayName,
  email,
  avatar,
  walletSummary,
}: {
  initialDisplayName: string;
  email: string;
  avatar: AccountImage;
  walletSummary: { label: string; detail: string };
}) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarState, setAvatarState] = useState<AccountImage>(avatar);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setStatus(null);
    try {
      const { image } = await uploadIdentityImage({ type: "avatar", file, previousKey: avatarState.imageKey });
      setAvatarState(image);
      setStatus("Avatar uploaded. Save profile to persist it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Avatar upload failed safely.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await parseJson(await fetch("/api/dashboard/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, avatarImageKey: avatarState.imageKey }),
      }));
      setStatus("Profile saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Profile update failed safely.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <div className="grid gap-2.5 md:grid-cols-[104px_1fr]">
        <div>
          <div className="grid h-16 w-16 place-items-center overflow-hidden rounded-full border border-white/10 bg-slate-900">
            {avatarState.imageUrl ? (
              <img src={avatarState.imageUrl} alt="Profile avatar" className="h-full w-full object-cover" />
            ) : (
              <span className="text-base font-semibold text-slate-300">{displayName.slice(0, 2).toUpperCase() || "CC"}</span>
            )}
          </div>
          <label className="mt-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
            <FormLabel optional className="text-[11px] text-white">Upload avatar</FormLabel>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onAvatar} className="sr-only" />
          </label>
          {avatarState.imageKey ? (
            <button type="button" onClick={() => setAvatarState({ imageKey: null, imageUrl: null })} className="mt-1.5 block text-[11px] font-semibold text-slate-300">
              Remove avatar
            </button>
          ) : null}
        </div>
        <div className="grid gap-2">
          <label className="block">
            <FormLabel required>Display name</FormLabel>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required aria-required="true" className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-200" />
          </label>
          <Info label="Email" value={email} readOnly />
          <Info label="Role" value="Brand" readOnly />
          <Info label="Workspace status" value="Active" readOnly />
          <Info label="Brand Wallet" value={`${walletSummary.label} - ${walletSummary.detail}`} readOnly />
        </div>
      </div>
      {status ? <p className="mt-2 text-[12px] font-medium text-cyan-100">{status}</p> : null}
      <button type="submit" disabled={pending} className="mt-2 inline-flex h-7 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-2.5 text-[11px] font-semibold text-white disabled:opacity-50">
        Save profile
      </button>
    </form>
  );
}

export function BrandCompanyForm({
  initial,
  logo,
}: {
  initial: {
    brandName: string;
    websiteUrl: string;
    companyDescription: string;
    linkedinUrl: string;
    instagramUrl: string;
    xUrl: string;
  };
  logo: AccountImage;
}) {
  const [form, setForm] = useState(initial);
  const [logoState, setLogoState] = useState<AccountImage>(logo);
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function field(name: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function onLogo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setPending(true);
    setStatus(null);
    try {
      const { image } = await uploadIdentityImage({ type: "brand-logo", file, previousKey: logoState.imageKey });
      setLogoState(image);
      setStatus("Brand logo uploaded. Save company settings to persist it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Brand logo upload failed safely.");
    } finally {
      setPending(false);
      event.target.value = "";
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus(null);
    try {
      await parseJson(await fetch("/api/dashboard/company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, brandLogoImageKey: logoState.imageKey }),
      }));
      setStatus("Company settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Company settings update failed safely.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 rounded-xl border border-white/10 bg-white/[0.035] p-2.5">
      <div className="grid gap-2.5 md:grid-cols-[126px_1fr]">
        <div>
          <div className="grid aspect-[4/1] w-full max-w-xs place-items-center overflow-hidden rounded-md border border-white/10 bg-slate-900 px-2 py-1.5">
            {logoState.imageUrl ? (
              <img src={logoState.imageUrl} alt="Brand logo" className="max-h-full max-w-full object-contain" />
            ) : (
              <span className="text-base font-semibold text-slate-300">{form.brandName.slice(0, 2).toUpperCase() || "BR"}</span>
            )}
          </div>
          <label className="mt-2 inline-flex h-7 cursor-pointer items-center rounded-md border border-white/10 px-2.5 text-[11px] font-semibold text-white transition hover:bg-white/[0.05]">
            <FormLabel optional className="text-[11px] text-white">Upload logo</FormLabel>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onLogo} className="sr-only" />
          </label>
          {logoState.imageKey ? (
            <button type="button" onClick={() => setLogoState({ imageKey: null, imageUrl: null })} className="mt-1.5 block text-[11px] font-semibold text-slate-300">
              Remove logo
            </button>
          ) : null}
        </div>
        <div className="grid gap-2">
          <Text label="Company / Brand name" value={form.brandName} onChange={(value) => field("brandName", value)} required />
          <Text label="Website" value={form.websiteUrl} onChange={(value) => field("websiteUrl", value)} placeholder="https://example.com" optional />
          <label className="block">
            <FormLabel optional>Short company description</FormLabel>
            <textarea value={form.companyDescription} onChange={(event) => field("companyDescription", event.target.value)} rows={2} className="mt-1 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 py-1.5 text-[12px] leading-4 text-white outline-none transition focus:border-cyan-200" />
          </label>
          <Text label="LinkedIn" value={form.linkedinUrl} onChange={(value) => field("linkedinUrl", value)} placeholder="https://linkedin.com/company/..." optional />
          <Text label="Instagram" value={form.instagramUrl} onChange={(value) => field("instagramUrl", value)} placeholder="https://instagram.com/..." optional />
          <Text label="X" value={form.xUrl} onChange={(value) => field("xUrl", value)} placeholder="https://x.com/..." optional />
        </div>
      </div>
      {status ? <p className="mt-2 text-[12px] font-medium text-cyan-100">{status}</p> : null}
      <button type="submit" disabled={pending} className="mt-2 inline-flex h-7 items-center rounded-md bg-gradient-to-r from-violet-600 to-blue-600 px-2.5 text-[11px] font-semibold text-white disabled:opacity-50">
        Save company settings
      </button>
    </form>
  );
}

function Text({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  optional?: boolean;
}) {
  return (
    <label className="block">
      <FormLabel required={required} optional={optional}>{label}</FormLabel>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} aria-required={required ? "true" : undefined} className="mt-1 h-8 w-full rounded-md border border-white/10 bg-slate-950/80 px-2.5 text-[12px] text-white outline-none transition focus:border-cyan-200" />
    </label>
  );
}

function Info({ label, value, readOnly = false }: { label: string; value: string; readOnly?: boolean }) {
  return (
    <div className="rounded-md border border-white/10 bg-slate-950/35 p-1.5">
      <dt className="text-[9px] font-semibold uppercase tracking-[0.06em] text-slate-400">
        <FormLabel readOnly={readOnly} className="text-[9px] text-slate-400">{label}</FormLabel>
      </dt>
      <dd className="mt-0.5 break-all text-[11px] font-medium text-white">{value}</dd>
    </div>
  );
}

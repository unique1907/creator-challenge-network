/* eslint-disable @next/next/no-img-element */

type BusinessChallengeCoverTone = "dark" | "light";

type BusinessChallengeCoverProps = {
  src?: string | null;
  alt?: string | null;
  title?: string;
  className: string;
  imageClassName?: string;
  placeholder?: string;
  tone?: BusinessChallengeCoverTone;
  decorative?: boolean;
};

function toneClassName(tone: BusinessChallengeCoverTone) {
  if (tone === "light") return "border-slate-200 bg-slate-100 text-slate-500";
  return "border-white/10 bg-[#070d19] text-slate-500";
}

export function formatBusinessChallengeHierarchy(input: {
  brand?: string | null;
  title: string;
  category?: string | null;
}) {
  const brand = input.brand?.trim() ?? "";
  const title = input.title.trim();
  const category = input.category?.trim() ?? "";
  const lowerBrand = brand.toLowerCase();
  const lowerTitle = title.toLowerCase();
  const titleWithoutBrand =
    brand && lowerTitle.startsWith(lowerBrand)
      ? title.slice(brand.length).replace(/^[\s:–—-]+/, "").trim()
      : title;

  return {
    brand,
    title: titleWithoutBrand || title,
    category,
  };
}

export function BusinessChallengeCover({
  src,
  alt,
  title = "Business challenge",
  className,
  imageClassName = "",
  placeholder = "Cover unavailable",
  tone = "dark",
  decorative = false,
}: BusinessChallengeCoverProps) {
  const resolvedAlt = decorative ? "" : alt ?? `${title} cover image`;
  const ariaHidden = decorative ? true : undefined;
  const overlayClassName = tone === "light" ? "bg-white/45" : "bg-slate-950/35";

  if (!src) {
    return (
      <div className={`grid place-items-center border text-[10px] font-bold uppercase tracking-[0.12em] ${toneClassName(tone)} ${className}`}>
        {placeholder}
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden border ${toneClassName(tone)} ${className}`}>
      <img src={src} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-lg saturate-125" />
      <div className={`absolute inset-0 ${overlayClassName}`} aria-hidden="true" />
      <img
        src={src}
        alt={resolvedAlt}
        aria-hidden={ariaHidden}
        className={`relative z-10 h-full w-full object-contain ${imageClassName}`}
      />
    </div>
  );
}

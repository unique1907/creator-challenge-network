import Image from "next/image";

type CCNLogoVariant = "full" | "mark";
type CCNLogoSize = "sm" | "md" | "lg" | "xl";

const logoConfig = {
  full: {
    src: "/brand/ccn-logo.svg",
    alt: "CCN Creator Challenge Network",
    width: 220,
    height: 72,
    sizes: {
      sm: "h-8",
      md: "h-10",
      lg: "h-[42px]",
      xl: "h-14",
    },
  },
  mark: {
    src: "/brand/ccn-mark.svg",
    alt: "CCN mark",
    width: 64,
    height: 64,
    sizes: {
      sm: "h-8",
      md: "h-10",
      lg: "h-12",
      xl: "h-14",
    },
  },
} satisfies Record<CCNLogoVariant, {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: Record<CCNLogoSize, string>;
}>;

export function CCNLogo({
  variant = "full",
  size = "md",
  priority = false,
  className = "",
}: {
  variant?: CCNLogoVariant;
  size?: CCNLogoSize;
  priority?: boolean;
  className?: string;
}) {
  const logo = logoConfig[variant];
  return (
    <Image
      src={logo.src}
      alt={logo.alt}
      width={logo.width}
      height={logo.height}
      priority={priority}
      className={`${logo.sizes[size]} w-auto object-contain ${className}`.trim()}
    />
  );
}

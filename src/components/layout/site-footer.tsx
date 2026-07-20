import Link from "next/link";

const footerColumns = [
  {
    title: "Product",
    links: [
      { label: "Explore Challenges", href: "/challenges" },
      { label: "How It Works", href: "/#how-it-works" },
    ],
  },
  {
    title: "For Brands",
    links: [
      { label: "Launch a Challenge", href: "/create-challenge" },
      { label: "Brand Resources", href: "/challenges" },
    ],
  },
  {
    title: "For Creators",
    links: [
      { label: "How to Participate", href: "/challenges" },
      { label: "Creator Resources", href: "/challenges" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About CCN", href: "/" },
      { label: "Contact", href: "/" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="bg-[#030a1f] text-slate-300">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 sm:px-8 lg:grid-cols-[1.4fr_repeat(4,1fr)_1.2fr] lg:px-10">
        <div>
          <Link
            href="/"
            className="inline-flex h-[52px] w-[52px] items-center justify-center rounded-lg border border-violet-500 text-lg font-bold text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
          >
            CCN
          </Link>
          <p className="mt-4 text-sm font-semibold text-white">
            Creator Challenge Network
          </p>
          <p className="mt-2 max-w-48 text-sm leading-6">
            Programmable creative competitions secured in USDC on Arc.
          </p>
        </div>

        {footerColumns.map((column) => (
          <div key={column.title}>
            <h2 className="text-sm font-bold text-white">{column.title}</h2>
            <ul className="mt-4 space-y-3 text-sm">
              {column.links.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-200"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="text-sm lg:text-right">
          <div className="flex gap-4 lg:justify-end">
            <a
              href="https://github.com/unique1907/creator-challenge-network"
              className="font-semibold text-white transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              GitHub
            </a>
            <Link
              href="/"
              className="font-semibold text-white transition hover:text-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-200"
            >
              Documentation
            </Link>
          </div>
          <p className="mt-5">© 2026 CCN</p>
          <p className="mt-1">Arc Testnet Prototype</p>
          <p className="mt-1">Demo brands not affiliated</p>
        </div>
      </div>
    </footer>
  );
}

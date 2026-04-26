"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/calendar", icon: "📅", label: "Calendar" },
  { href: "/chores", icon: "✅", label: "Chores" },
  { href: "/meals", icon: "🍽️", label: "Meals" },
  { href: "/lists", icon: "📝", label: "Lists" },
  { href: "/settings", icon: "⚙️", label: "Settings" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-24 bg-cc-cream h-screen sticky top-0 items-center py-6 gap-3 border-r border-cc-line">
        {/* Wordmark */}
        <Link
          href="/calendar"
          className="mb-4 text-display-md leading-none text-cc-ink select-none"
          style={{ fontFamily: "var(--font-display)" }}
          title="ChuppaCal"
        >
          CC
        </Link>

        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`w-16 h-16 rounded-cc-pill flex items-center justify-center text-3xl touch-manipulation transition-colors ${
                isActive
                  ? "bg-cc-ink text-cc-white"
                  : "bg-transparent text-cc-ink hover:bg-cc-beige active:bg-cc-beige"
              }`}
              title={item.label}
              aria-label={item.label}
            >
              {item.icon}
            </Link>
          );
        })}
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-cc-cream border-t border-cc-line flex items-center justify-around py-2 px-2 z-40">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 px-3 rounded-cc-md touch-manipulation transition-colors ${
                isActive
                  ? "bg-cc-ink text-cc-white"
                  : "text-cc-ink-dim"
              }`}
              aria-label={item.label}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

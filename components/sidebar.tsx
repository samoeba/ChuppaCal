"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/today", icon: null, label: "Today" },
  { href: "/calendar", icon: "calendar.svg", label: "Calendar" },
  { href: "/chores", icon: "tasks.svg", label: "Chores" },
  { href: "/meals", icon: "meals.svg", label: "Meals" },
  { href: "/lists", icon: "lists.svg", label: "Lists" },
  { href: "/settings", icon: "settings.svg", label: "Settings" },
];

function NavIcon({ icon }: { icon: string | null }) {
  if (!icon) {
    return (
      <span aria-hidden="true" className="flex size-6 items-center justify-center text-xl md:size-9 md:text-3xl">
        ☀️
      </span>
    );
  }

  return (
    <Image
      src={`/chuppacal-sidebar-icons/${icon}`}
      alt=""
      width={36}
      height={36}
      className="size-6 md:size-9"
      unoptimized
    />
  );
}

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-24 bg-cc-cream h-screen sticky top-0 items-center py-6 gap-3 border-r border-cc-line">
        {/* Wordmark */}
        <Link
          href="/calendar"
          prefetch
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
              prefetch
              className={`w-16 h-16 rounded-cc-pill flex items-center justify-center touch-manipulation transition-colors ${
                isActive
                  ? "bg-cc-beige ring-2 ring-inset ring-cc-ink text-cc-ink"
                  : "bg-transparent text-cc-ink hover:bg-cc-beige active:bg-cc-beige"
              }`}
              title={item.label}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon icon={item.icon} />
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
              prefetch
              className={`flex flex-1 min-w-0 flex-col items-center gap-0.5 py-2 px-1 rounded-cc-md touch-manipulation transition-colors ${
                isActive
                  ? "bg-cc-beige ring-2 ring-inset ring-cc-ink text-cc-ink"
                  : "text-cc-ink-dim"
              }`}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
            >
              <NavIcon icon={item.icon} />
              <span className="text-[10px] font-bold">
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}

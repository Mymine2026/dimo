"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Car, BarChart2, FileText, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/vehicles", icon: Car, label: "Fleet" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex border-t"
      style={{
        background: "#1e1f23",
        borderColor: "rgba(255,255,255,0.06)",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 pt-3 pb-1"
          >
            <Icon
              className="w-[22px] h-[22px]"
              strokeWidth={active ? 2.5 : 1.75}
              style={{ color: active ? "#ffffff" : "#555869" }}
            />
            <span
              className="text-[10px] font-medium tracking-wide"
              style={{ color: active ? "#ffffff" : "#555869" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

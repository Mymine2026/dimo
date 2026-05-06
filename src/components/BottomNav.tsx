"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, BarChart2, FileText, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/vehicles",  icon: Truck,     label: "Fleet"     },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/documents", icon: FileText,  label: "Documents" },
  { href: "/profile",   icon: User,      label: "Profile"   },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)", paddingLeft: 16, paddingRight: 16 }}
    >
      <div
        className="flex w-full"
        style={{
          background: "#1e1f23",
          borderRadius: 24,
          padding: "6px 8px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
          maxWidth: 420,
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className="flex flex-1 flex-col items-center gap-1 py-1"
            >
              <div
                className="flex items-center justify-center transition-all"
                style={{
                  background: active ? "#ffffff" : "transparent",
                  borderRadius: 14,
                  padding: "7px 18px",
                  minWidth: 52,
                }}
              >
                <Icon
                  className="w-5 h-5"
                  strokeWidth={active ? 2.25 : 1.75}
                  style={{ color: active ? "#000000" : "#8e9192" }}
                />
              </div>
              <span
                className="text-[10px] font-semibold tracking-wide transition-colors"
                style={{ color: active ? "#ffffff" : "#8e9192" }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Truck, BarChart2, FileText, User } from "lucide-react";

const NAV_ITEMS = [
  { href: "/vehicles", icon: Truck, label: "Fleet" },
  { href: "/analytics", icon: BarChart2, label: "Analytics" },
  { href: "/documents", icon: FileText, label: "Documents" },
  { href: "/profile", icon: User, label: "Profile" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex"
      style={{
        background: "#0d0e12",
        borderTop: "1px solid #444748",
        paddingBottom: "max(env(safe-area-inset-bottom), 8px)",
      }}
    >
      {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
        const active = pathname === href || pathname.startsWith(href + "/");
        return (
          <Link
            key={href}
            href={href}
            className="flex flex-1 flex-col items-center gap-1 pt-2.5 pb-1"
          >
            <div
              className="flex items-center justify-center rounded-xl"
              style={{
                background: active ? "#1e1f23" : "transparent",
                padding: "5px 14px",
              }}
            >
              <Icon
                className="w-[20px] h-[20px]"
                strokeWidth={active ? 2.25 : 1.75}
                style={{ color: active ? "#ffffff" : "#8e9192" }}
              />
            </div>
            <span
              className="text-[10px] font-medium tracking-wide"
              style={{ color: active ? "#ffffff" : "#8e9192" }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

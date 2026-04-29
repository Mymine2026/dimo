import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Car, LayoutDashboard } from "lucide-react";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "MyMine — Vehicle Dashboard",
  description: "Monitor your DIMO-connected vehicles",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark`}>
      <body className="antialiased bg-zinc-950 text-white min-h-screen">
        <div className="flex min-h-screen">
          <aside className="w-64 border-r border-zinc-800 flex flex-col p-6 gap-2 fixed h-full">
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight">MyMine</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Vehicle Intelligence</p>
            </div>
            <nav className="flex flex-col gap-1">
              <Link href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Link>
              <Link href="/vehicles" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors">
                <Car className="w-4 h-4" />
                Vehicles
              </Link>
            </nav>
            <div className="mt-auto">
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs text-zinc-500">DIMO Network</span>
              </div>
            </div>
          </aside>
          <main className="ml-64 flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}

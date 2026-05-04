import Link from "next/link";
import { Car, LayoutDashboard, User } from "lucide-react";
import { LogoutButton } from "@/components/LogoutButton";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r border-zinc-800 flex flex-col p-6 gap-2 fixed h-full">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight">MyMine</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Vehicle Intelligence</p>
        </div>
        <nav className="flex flex-col gap-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Link>
          <Link
            href="/vehicles"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <Car className="w-4 h-4" />
            Vehicles
          </Link>
        </nav>
        <div className="mt-auto flex flex-col gap-2">
          <div className="flex items-center gap-2 px-3 py-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-zinc-500">DIMO Network</span>
          </div>
          {session?.user?.email && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-zinc-800">
              <User className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="text-xs text-zinc-400 truncate">{session.user.email}</span>
            </div>
          )}
          <LogoutButton />
        </div>
      </aside>
      <main className="ml-64 flex-1 p-8">{children}</main>
    </div>
  );
}

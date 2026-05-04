import { BottomNav } from "@/components/BottomNav";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: "#121317" }}>
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}

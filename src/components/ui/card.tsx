import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("rounded-2xl p-4", className)}
      style={{ background: "#1e1f23", borderRadius: 16 }}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <h3 className={cn("text-[11px] mb-1.5", className)} style={{ color: "#6b7280" }}>
      {children}
    </h3>
  );
}

export function CardValue({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={cn("text-[22px] font-bold leading-none text-white", className)}>
      {children}
    </p>
  );
}

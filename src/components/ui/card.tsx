import { cn } from "@/lib/utils";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-2xl border border-zinc-800 bg-zinc-900 p-6", className)}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <h3 className={cn("text-sm font-medium text-zinc-400 mb-1", className)}>{children}</h3>;
}

export function CardValue({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("text-2xl font-bold text-white", className)}>{children}</p>;
}

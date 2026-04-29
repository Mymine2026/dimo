"use client";

import Link from "next/link";
import { Car, Cpu } from "lucide-react";
import { Vehicle } from "@/types/dimo";
import { cn } from "@/lib/utils";

export function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const { tokenId, definition, aftermarketDevice, syntheticDevice } = vehicle;
  const hasDevice = !!aftermarketDevice || !!syntheticDevice;

  return (
    <Link href={`/vehicles/${tokenId}`}>
      <div className="group rounded-2xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-600 transition-all cursor-pointer">
        <div className="flex items-start justify-between mb-4">
          <div className="w-12 h-12 rounded-xl bg-zinc-800 flex items-center justify-center">
            <Car className="w-6 h-6 text-zinc-400" />
          </div>
          <span className={cn(
            "text-xs px-2 py-1 rounded-full font-medium",
            hasDevice ? "bg-emerald-900/50 text-emerald-400" : "bg-zinc-800 text-zinc-500"
          )}>
            {hasDevice ? "Connected" : "No device"}
          </span>
        </div>

        <div>
          <p className="text-white font-semibold text-lg leading-tight">
            {definition.year} {definition.make}
          </p>
          <p className="text-zinc-400 text-sm">{definition.model}</p>
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
          <Cpu className="w-3 h-3" />
          <span>Token #{tokenId}</span>
        </div>
      </div>
    </Link>
  );
}

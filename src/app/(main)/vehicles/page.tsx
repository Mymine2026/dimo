"use client";

import { useEffect, useState } from "react";
import { VehicleCard } from "@/components/VehicleCard";
import { Vehicle } from "@/types/dimo";
import { Loader2, AlertCircle } from "lucide-react";

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/vehicles");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to load vehicles");
        setVehicles(data);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Vehicles</h2>
        <p className="text-zinc-400 mt-1">Your DIMO-connected fleet</p>
      </div>

      {loading && (
        <div className="flex items-center gap-3 text-zinc-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading vehicles…
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 text-red-400 bg-red-900/20 border border-red-800 rounded-lg p-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && vehicles.length > 0 && (
        <>
          <p className="text-sm text-zinc-500 mb-5">{vehicles.length} vehicles found</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {vehicles.map((v) => (
              <VehicleCard key={v.tokenId} vehicle={v} />
            ))}
          </div>
        </>
      )}

      {!loading && !error && vehicles.length === 0 && (
        <p className="text-zinc-500 text-sm">No vehicles found.</p>
      )}
    </div>
  );
}

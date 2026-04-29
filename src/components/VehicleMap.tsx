"use client";

import { useEffect, useRef } from "react";
import { TelemetrySignal } from "@/types/dimo";

interface Props {
  signals: TelemetrySignal[];
}

export function VehicleMap({ signals }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<unknown>(null);

  const points = signals
    .filter((s) => s.location != null)
    .map((s) => [s.location!.latitude, s.location!.longitude] as [number, number]);

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    // Dynamically import leaflet to avoid SSR issues
    import("leaflet").then((L) => {
      if (mapInstance.current) {
        (mapInstance.current as ReturnType<typeof L.map>).remove();
      }

      const center = points[points.length - 1];
      const map = L.map(mapRef.current!).setView(center, 13);
      mapInstance.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      if (points.length > 1) {
        L.polyline(points, { color: "#22c55e", weight: 3, opacity: 0.8 }).addTo(map);
      }

      const lastIcon = L.divIcon({
        html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
        iconSize: [14, 14],
        className: "",
      });
      L.marker(center, { icon: lastIcon }).addTo(map);
    });

    return () => {
      if (mapInstance.current) {
        (mapInstance.current as { remove: () => void }).remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signals]);

  if (points.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 rounded-xl bg-zinc-800 text-zinc-500 text-sm">
        No GPS data available
      </div>
    );
  }

  return <div ref={mapRef} className="h-64 w-full rounded-xl overflow-hidden z-0" />;
}

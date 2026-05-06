"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface GpsPoint {
  timestamp: string;
  location: { latitude: number; longitude: number };
}

interface Props {
  points: GpsPoint[];
}

export function VehicleMap({ points }: Props) {
  const mapRef     = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!mapRef.current || points.length === 0) return;

    import("leaflet").then(async (L) => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const map = L.map(mapRef.current!, { zoomControl: true });
      mapInstance.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors © <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      const latLngs = points.map(
        (p) => [p.location.latitude, p.location.longitude] as [number, number]
      );

      // Try OSRM map-matching for road-snapped route
      let routeDrawn = false;
      if (points.length >= 2) {
        try {
          // Subsample to max 100 points (OSRM default limit)
          const sampled =
            points.length > 100
              ? points.filter((_, i) => i % Math.ceil(points.length / 100) === 0)
              : points;

          const coords = sampled
            .map((p) => `${p.location.longitude},${p.location.latitude}`)
            .join(";");

          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(
            `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson`,
            { signal: controller.signal }
          );
          clearTimeout(tid);

          if (res.ok) {
            const data = await res.json();
            if (data.matchings?.length > 0) {
              const roadCoords: [number, number][] = data.matchings[0].geometry.coordinates.map(
                ([lon, lat]: [number, number]) => [lat, lon]
              );
              L.polyline(roadCoords, { color: "#22c55e", weight: 3, opacity: 0.85 }).addTo(map);
              routeDrawn = true;
            }
          }
        } catch {
          // OSRM timeout or error — fall through to simple polyline
        }
      }

      // Fallback: simple dashed polyline
      if (!routeDrawn && latLngs.length > 1) {
        L.polyline(latLngs, {
          color: "#22c55e",
          weight: 3,
          opacity: 0.7,
          dashArray: "6 4",
        }).addTo(map);
      }

      // Start marker (gray) — only when there are multiple points
      if (latLngs.length > 1) {
        L.marker(latLngs[0], {
          icon: L.divIcon({
            html: `<div style="width:10px;height:10px;border-radius:50%;background:#6b7280;border:2px solid white;box-shadow:0 0 4px rgba(0,0,0,0.5)"></div>`,
            iconSize: [10, 10],
            className: "",
          }),
        }).addTo(map);
      }

      // Current position marker (green)
      L.marker(latLngs[latLngs.length - 1], {
        icon: L.divIcon({
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#22c55e;border:3px solid white;box-shadow:0 0 8px rgba(34,197,94,0.6)"></div>`,
          iconSize: [14, 14],
          className: "",
        }),
      }).addTo(map);

      // Auto-zoom to fit all points
      map.fitBounds(L.latLngBounds(latLngs), { padding: [20, 20] });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(points)]);

  if (points.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-64 rounded-xl text-sm"
        style={{ background: "#1a1b1e", color: "#6b7280" }}
      >
        Nessun dato GPS disponibile
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="h-64 w-full rounded-xl overflow-hidden"
      style={{ zIndex: 0 }}
    />
  );
}

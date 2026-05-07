"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface LocationPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
}

interface Props {
  locations: LocationPoint[];
  height?: string;
}

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

export function VehicleMap({ locations, height = "300px" }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!mapRef.current || locations.length === 0) return;

    import("leaflet").then(async (L) => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }

      const map = L.map(mapRef.current!, { zoomControl: true });
      mapInstance.current = map;

      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
        attribution: "© OpenStreetMap © CARTO",
        subdomains: "abcd",
        maxZoom: 20,
      }).addTo(map);

      const latLngs: [number, number][] = locations.map((p) => [p.latitude, p.longitude]);

      // ── OSRM map-matching (2–100 punti) ──
      let routeDrawn = false;
      if (locations.length >= 2 && locations.length <= 100) {
        try {
          const coords  = locations.map((l) => `${l.longitude},${l.latitude}`).join(";");
          const radii   = locations.map(() => "50").join(";");
          const url     = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radii}`;

          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 10_000);
          const res = await fetch(url, { signal: controller.signal });
          clearTimeout(tid);

          if (res.ok) {
            const data = await res.json();
            if (data.matchings?.length > 0) {
              const geojson = {
                type: "FeatureCollection" as const,
                features: (data.matchings as { geometry: object }[]).map((m) => ({
                  type: "Feature" as const,
                  geometry: m.geometry,
                  properties: {},
                })),
              };
              L.geoJSON(geojson, {
                style: { color: "#3b82f6", weight: 3, opacity: 0.85 },
              }).addTo(map);
              routeDrawn = true;
            }
          }
        } catch {
          // fallback sotto
        }
      }

      if (!routeDrawn && latLngs.length > 1) {
        L.polyline(latLngs, { color: "#3b82f6", weight: 3, opacity: 0.75 }).addTo(map);
      }

      // ── Marker prima posizione (grigio) ──
      if (latLngs.length > 1) {
        L.marker(latLngs[0], {
          icon: L.divIcon({
            html: `<div style="width:10px;height:10px;border-radius:50%;background:#6b7280;border:2px solid #fff"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
            className: "",
          }),
        })
          .bindPopup(`Partenza: ${fmtTime(locations[0].timestamp)}`)
          .addTo(map);
      }

      // ── Marker ultima posizione (verde) ──
      const last = locations[locations.length - 1];
      L.marker(latLngs[latLngs.length - 1], {
        icon: L.divIcon({
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.7)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
          className: "",
        }),
      })
        .bindPopup(`Ultima posizione: ${fmtTime(last.timestamp)}`)
        .addTo(map);

      map.fitBounds(L.latLngBounds(latLngs), { padding: [24, 24] });
    });

    return () => {
      if (mapInstance.current) {
        mapInstance.current.remove();
        mapInstance.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(locations)]);

  if (locations.length === 0) {
    return (
      <div
        className="flex items-center justify-center w-full rounded-xl text-sm"
        style={{ background: "#1e1f23", color: "#6b7280", height }}
      >
        Nessun dato GPS disponibile
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full"
      style={{ height, zIndex: 0 }}
    />
  );
}

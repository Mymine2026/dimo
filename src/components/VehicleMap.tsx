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

// Evenly sample down to `max` points, always keeping first and last
function samplePoints(pts: LocationPoint[], max: number): LocationPoint[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
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

      // ── Tile layer ────────────────────────────────────────────────────────
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            attribution: '© <a href="https://www.mapbox.com" target="_blank">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
            maxZoom: 22,
          }
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
      }

      const latLngs: [number, number][] = locations.map((p) => [p.latitude, p.longitude]);

      // ── OSRM map-matching ─────────────────────────────────────────────────
      let routeDrawn = false;
      if (locations.length >= 2) {
        try {
          const sampled = samplePoints(locations, 50);
          const coords  = sampled.map((l) => `${l.longitude},${l.latitude}`).join(";");
          const radii   = sampled.map(() => "50").join(";");
          const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radii}`;

          console.log(`[VehicleMap] OSRM: ${sampled.length} punti (originali: ${locations.length})`);

          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 5_000);
          let res: Response;
          try {
            res = await fetch(url, { signal: controller.signal });
          } finally {
            clearTimeout(tid);
          }

          if (!res!.ok) {
            const body = await res!.text().catch(() => "");
            console.warn(`[VehicleMap] OSRM HTTP ${res!.status}:`, body.slice(0, 200));
          } else {
            const data = await res!.json();
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
                style: { color: "#f97316", weight: 5, opacity: 0.9 },
              }).addTo(map);
              routeDrawn = true;
              console.log("[VehicleMap] OSRM: percorso tracciato");
            } else {
              console.warn("[VehicleMap] OSRM: nessun matching —", data.code, data.message);
            }
          }
        } catch (err) {
          console.warn(
            "[VehicleMap] OSRM fallito:",
            err instanceof Error ? err.message : String(err)
          );
        }
      }

      // ── Fallback polyline (tratteggiata arancione = approssimativa) ───────
      if (!routeDrawn && latLngs.length > 1) {
        L.polyline(latLngs, {
          color: "#f59e0b",
          weight: 2,
          opacity: 0.75,
          dashArray: "6 5",
        }).addTo(map);
        console.log("[VehicleMap] Fallback: polyline approssimativa");
      }

      // ── Marker partenza (rosso) ───────────────────────────────────────────
      if (latLngs.length > 1) {
        L.marker(latLngs[0], {
          icon: L.divIcon({
            html: `<div style="width:11px;height:11px;border-radius:50%;background:#ef4444;border:2px solid #fff;box-shadow:0 0 6px rgba(239,68,68,0.6)"></div>`,
            iconSize: [11, 11],
            iconAnchor: [5, 5],
            className: "",
          }),
        })
          .bindPopup(`Partenza: ${fmtTime(locations[0].timestamp)}`)
          .addTo(map);
      }

      // ── Marker ultima posizione (verde pulsante) ──────────────────────────
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

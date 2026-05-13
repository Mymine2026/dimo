"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";

export interface LocationPoint {
  timestamp: string;
  latitude: number;
  longitude: number;
}

type MapMode = "heatmap" | "route";

interface Props {
  /** All GPS points for the heatmap (full range) */
  allLocations: LocationPoint[];
  /** Recent GPS points for the route view (e.g. last 24h) */
  recentLocations: LocationPoint[];
  height?: string;
}

// Leaflet augmented with leaflet.heat
type LHeat = {
  heatLayer: (
    latlngs: [number, number][],
    options?: {
      radius?: number;
      blur?: number;
      maxZoom?: number;
      gradient?: Record<number, string>;
      minOpacity?: number;
    }
  ) => import("leaflet").Layer;
};

function fmtTime(ts: string) {
  return new Date(ts).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
}

function samplePoints(pts: LocationPoint[], max: number): LocationPoint[] {
  if (pts.length <= max) return pts;
  const step = (pts.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => pts[Math.round(i * step)]);
}

export function VehicleMap({ allLocations, recentLocations, height = "300px" }: Props) {
  const [mode, setMode] = useState<MapMode>("heatmap");
  const modeRef     = useRef<MapMode>("heatmap");
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);
  const heatRef     = useRef<import("leaflet").Layer | null>(null);
  const routeRef    = useRef<import("leaflet").Layer | null>(null);

  // Keep modeRef in sync for reading inside async callbacks
  useEffect(() => { modeRef.current = mode; }, [mode]);

  // ── Main effect: create/recreate map when location data changes ──────────────
  useEffect(() => {
    const heatPts = allLocations;
    const routePts = recentLocations.length > 0 ? recentLocations : allLocations;

    if (!mapRef.current || heatPts.length === 0) return;

    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    heatRef.current  = null;
    routeRef.current = null;

    let isMounted = true;

    (async () => {
      const Lmod = await import("leaflet");
      const L = Lmod.default ?? (Lmod as unknown as typeof import("leaflet"));
      await import("leaflet.heat");
      const LH = L as unknown as typeof L & LHeat;

      if (!isMounted || !mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true });
      mapInstance.current = map;

      // ── Tiles ──
      const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
      if (mapboxToken) {
        L.tileLayer(
          `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/tiles/{z}/{x}/{y}?access_token=${mapboxToken}`,
          {
            tileSize: 512,
            zoomOffset: -1,
            attribution: '© <a href="https://www.mapbox.com">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
            maxZoom: 22,
          }
        ).addTo(map);
      } else {
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);
      }

      // ── Heatmap layer ──
      const heat = LH.heatLayer(
        heatPts.map(p => [p.latitude, p.longitude]),
        {
          radius: 25,
          blur: 20,
          maxZoom: 17,
          gradient: { 0.0: "blue", 0.3: "cyan", 0.6: "yellow", 0.8: "orange", 1.0: "red" },
        }
      );
      heatRef.current = heat;

      // ── Route layer (OSRM + fallback) ──
      const routeLatLngs: [number, number][] = routePts.map(p => [p.latitude, p.longitude]);
      let routeDrawn = false;

      if (routePts.length >= 2) {
        try {
          const sampled = samplePoints(routePts, 50);
          const coords  = sampled.map(l => `${l.longitude},${l.latitude}`).join(";");
          const radii   = sampled.map(() => "50").join(";");
          const url = `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radii}`;

          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 5_000);
          let res: Response;
          try { res = await fetch(url, { signal: controller.signal }); }
          finally { clearTimeout(tid); }

          if (!isMounted) return;

          if (res!.ok) {
            const data = await res!.json();
            if (data.matchings?.length > 0) {
              const geojson = {
                type: "FeatureCollection" as const,
                features: (data.matchings as { geometry: object }[]).map(m => ({
                  type: "Feature" as const, geometry: m.geometry, properties: {},
                })),
              };
              routeRef.current = L.geoJSON(geojson, { style: { color: "#f97316", weight: 5, opacity: 0.9 } });
              routeDrawn = true;
            } else {
              console.warn("[VehicleMap] OSRM:", data.code, data.message);
            }
          } else {
            console.warn(`[VehicleMap] OSRM HTTP ${res!.status}`);
          }
        } catch (err) {
          console.warn("[VehicleMap] OSRM:", err instanceof Error ? err.message : err);
        }
      }

      if (!routeDrawn && routeLatLngs.length > 1) {
        routeRef.current = L.polyline(routeLatLngs, {
          color: "#f59e0b", weight: 2, opacity: 0.75, dashArray: "6 5",
        });
      }

      if (!isMounted) return;

      // ── Apply initial mode ──
      if (modeRef.current === "heatmap") {
        heat.addTo(map);
      } else if (routeRef.current) {
        routeRef.current.addTo(map);
      }

      // ── Markers ──
      const markerPts = routePts.length > 0 ? routePts : heatPts;
      if (markerPts.length > 1) {
        L.marker([markerPts[0].latitude, markerPts[0].longitude], {
          icon: L.divIcon({
            html: `<div style="width:11px;height:11px;border-radius:50%;background:#ef4444;border:2px solid rgba(255,255,255,0.85);box-shadow:0 0 6px rgba(239,68,68,0.6)"></div>`,
            iconSize: [11, 11], iconAnchor: [5, 5], className: "",
          }),
        }).bindPopup(`Partenza: ${fmtTime(markerPts[0].timestamp)}`).addTo(map);
      }

      const last = markerPts[markerPts.length - 1];
      L.marker([last.latitude, last.longitude], {
        icon: L.divIcon({
          html: `<div style="width:13px;height:13px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 8px rgba(34,197,94,0.7)"></div>`,
          iconSize: [13, 13], iconAnchor: [6, 6], className: "",
        }),
      }).bindPopup(`Ultima posizione: ${fmtTime(last.timestamp)}`).addTo(map);

      // ── Fit bounds on all GPS points ──
      const allLatLngs = heatPts.map(p => [p.latitude, p.longitude] as [number, number]);
      map.fitBounds(L.latLngBounds(allLatLngs), { padding: [24, 24] });
    })();

    return () => {
      isMounted = false;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(allLocations), JSON.stringify(recentLocations)]);

  // ── Mode toggle: swap layers without recreating the map ──────────────────────
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const heat  = heatRef.current;
    const route = routeRef.current;
    if (mode === "heatmap") {
      if (heat)  heat.addTo(map);
      if (route) map.removeLayer(route);
    } else {
      if (heat)  map.removeLayer(heat);
      if (route) route.addTo(map);
    }
  }, [mode]);

  const hasLocations = allLocations.length > 0 || recentLocations.length > 0;

  if (!hasLocations) {
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
    <div style={{ position: "relative", height }}>
      <div ref={mapRef} className="w-full h-full" style={{ zIndex: 0 }} />
      <button
        onClick={() => setMode(m => m === "heatmap" ? "route" : "heatmap")}
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1000,
          background: "#1e1f23",
          border: "1px solid rgba(255,255,255,0.3)",
          color: "#ffffff",
          borderRadius: 8,
          padding: "5px 10px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
          backdropFilter: "blur(4px)",
        }}
      >
        {mode === "heatmap" ? "📍 Percorso" : "🔥 Heatmap"}
      </button>
    </div>
  );
}

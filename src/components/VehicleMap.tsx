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
}

export function VehicleMap({ locations }: Props) {
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

      const latLngs: [number, number][] = locations.map(
        (p) => [p.latitude, p.longitude]
      );

      // OSRM map-matching for < 25 points
      let routeDrawn = false;
      if (locations.length >= 2 && locations.length < 25) {
        try {
          const coords = locations.map((p) => `${p.longitude},${p.latitude}`).join(";");
          const radii  = locations.map(() => "50").join(";");

          const controller = new AbortController();
          const tid = setTimeout(() => controller.abort(), 8000);

          const res = await fetch(
            `https://router.project-osrm.org/match/v1/driving/${coords}?overview=full&geometries=geojson&radiuses=${radii}`,
            { signal: controller.signal }
          );
          clearTimeout(tid);

          if (res.ok) {
            const data = await res.json();
            if (data.matchings?.length > 0) {
              const road: [number, number][] = data.matchings
                .flatMap((m: { geometry: { coordinates: [number, number][] } }) =>
                  m.geometry.coordinates.map(([lon, lat]: [number, number]) => [lat, lon] as [number, number])
                );
              L.polyline(road, { color: "#3b82f6", weight: 3, opacity: 0.85 }).addTo(map);
              routeDrawn = true;
            }
          }
        } catch {
          // fallback to simple polyline
        }
      }

      if (!routeDrawn && latLngs.length > 1) {
        L.polyline(latLngs, { color: "#3b82f6", weight: 3, opacity: 0.75 }).addTo(map);
      }

      // Start marker — gray circle 6px
      if (latLngs.length > 1) {
        L.marker(latLngs[0], {
          icon: L.divIcon({
            html: `<div style="width:6px;height:6px;border-radius:50%;background:#6b7280;border:2px solid #fff"></div>`,
            iconSize: [6, 6],
            className: "",
          }),
        }).addTo(map);
      }

      // Current position — green circle 8px
      L.marker(latLngs[latLngs.length - 1], {
        icon: L.divIcon({
          html: `<div style="width:8px;height:8px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 6px rgba(34,197,94,0.7)"></div>`,
          iconSize: [8, 8],
          className: "",
        }),
      }).addTo(map);

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
        className="flex items-center justify-center h-64 rounded-xl text-sm"
        style={{ background: "#1e1f23", color: "#6b7280" }}
      >
        Nessun dato GPS
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

"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

export interface FleetPosition {
  tokenId: number;
  label: string;
  latitude: number;
  longitude: number;
  timestamp: string;
}

interface Props {
  positions: FleetPosition[];
  height?: string;
}

export function FleetMap({ positions, height = "300px" }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<import("leaflet").Map | null>(null);

  useEffect(() => {
    if (!mapRef.current || positions.length === 0) return;
    if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }

    let isMounted = true;

    (async () => {
      const Lmod = await import("leaflet");
      const L = Lmod.default ?? (Lmod as unknown as typeof import("leaflet"));

      if (!isMounted || !mapRef.current) return;

      const map = L.map(mapRef.current, { zoomControl: true });
      mapInstance.current = map;

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

      const latlngs: [number, number][] = [];
      for (const pos of positions) {
        const d = new Date(pos.timestamp);
        const timeStr = `${d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" })} ${d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}`;
        L.marker([pos.latitude, pos.longitude], {
          icon: L.divIcon({
            html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none">
              <div style="width:12px;height:12px;border-radius:50%;background:#22c55e;border:2px solid #fff;box-shadow:0 0 6px rgba(34,197,94,0.7)"></div>
              <div style="margin-top:2px;background:rgba(20,20,24,0.92);border:1px solid rgba(255,255,255,0.15);border-radius:4px;padding:1px 6px;font-size:9px;font-weight:700;color:#fff;white-space:nowrap">🅿️ ${pos.label}</div>
            </div>`,
            iconAnchor: [6, 6],
            iconSize: [0, 0],
            className: "",
          }),
        }).bindPopup(`<b>${pos.label}</b><br>Ultima posizione nota<br>${timeStr}`).addTo(map);
        latlngs.push([pos.latitude, pos.longitude]);
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 13);
      } else {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
      }
    })();

    return () => {
      isMounted = false;
      if (mapInstance.current) { mapInstance.current.remove(); mapInstance.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(positions)]);

  if (positions.length === 0) {
    return (
      <div
        className="flex items-center justify-center w-full rounded-xl text-sm"
        style={{ background: "#1e1f23", color: "#6b7280", height }}
      >
        Nessuna posizione disponibile
      </div>
    );
  }

  return <div ref={mapRef} className="w-full rounded-xl" style={{ height, zIndex: 0 }} />;
}

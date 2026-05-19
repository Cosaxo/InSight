// visits-map.tsx — Leaflet map showing pins for every logged visit.
//
// Loaded lazily so Leaflet's ~150KB only lands when the user opens
// the map. Tile layer is OpenStreetMap (free, attribution
// preserved; no API key). Pins resolve via the country-centroid
// table — city precision isn't here yet (visits store country +
// optional city as free text, no lat/lng).

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Visit } from "../../types";
import { lookupCountryCentroid } from "../../data/countryCentroids";

interface VisitsMapProps {
  visits: Visit[];
}

interface ResolvedPin {
  visit: Visit;
  lat: number;
  lng: number;
}

function resolveVisits(visits: Visit[]): {
  pins: ResolvedPin[];
  unresolved: Visit[];
} {
  const pins: ResolvedPin[] = [];
  const unresolved: Visit[] = [];
  for (const v of visits) {
    const c = lookupCountryCentroid(v.country);
    if (!c) {
      unresolved.push(v);
      continue;
    }
    pins.push({ visit: v, lat: c[0], lng: c[1] });
  }
  return { pins, unresolved };
}

export default function VisitsMap({ visits }: VisitsMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const { pins, unresolved } = resolveVisits(visits);

  // Initialise the map once on mount. Re-renders only update the
  // marker layer below, not the underlying tile + viewport setup.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, {
      // World view by default; we re-centre to fit pins below.
      center: [20, 0],
      zoom: 1.5,
      scrollWheelZoom: false,
      worldCopyJump: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Re-render pins whenever the visits prop changes.
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer) return;
    layer.clearLayers();
    if (pins.length === 0) return;
    // Aggregate pins per country so repeat visits don't stack one
    // on top of another invisibly. Each marker's popup lists every
    // visit logged for that country.
    const byKey = new Map<string, ResolvedPin[]>();
    for (const p of pins) {
      const key = `${p.lat},${p.lng}`;
      const arr = byKey.get(key) ?? [];
      arr.push(p);
      byKey.set(key, arr);
    }
    const bounds: [number, number][] = [];
    for (const [, arr] of byKey) {
      const first = arr[0];
      bounds.push([first.lat, first.lng]);
      const marker = L.circleMarker([first.lat, first.lng], {
        radius: Math.min(6 + arr.length, 14),
        color: "oklch(0.45 0.13 30)",
        fillColor: "oklch(0.78 0.12 30)",
        fillOpacity: 0.85,
        weight: 1.2,
      });
      const lines = arr
        .map((p) => {
          const dates = p.visit.end
            ? `${p.visit.start} → ${p.visit.end}`
            : p.visit.start;
          const where = p.visit.city
            ? `${p.visit.city}, ${p.visit.country}`
            : p.visit.country;
          return `<div>${where}<br><span style="font-size:10px;color:#666">${dates}</span></div>`;
        })
        .join("<hr style='border:0;border-top:1px dashed #ccc;margin:6px 0'>");
      marker.bindPopup(lines, { closeButton: false });
      marker.addTo(layer);
    }
    if (bounds.length > 0) {
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 5 });
    }
  }, [pins]);

  return (
    <div>
      <div
        ref={containerRef}
        style={{
          width: "100%",
          height: 360,
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--paper)",
          border: "0.5px solid var(--rule)",
        }}
      />
      {unresolved.length > 0 && (
        <div
          className="margin-note"
          style={{
            marginTop: 8,
            fontSize: 11,
            color: "var(--ink-3)",
            fontStyle: "italic",
          }}
        >
          {unresolved.length} visit{unresolved.length === 1 ? "" : "s"}{" "}
          couldn't be placed (country name not in the lookup):{" "}
          {unresolved.map((v) => v.country).join(", ")}.
        </div>
      )}
      <div
        className="margin-note"
        style={{ marginTop: 6, fontSize: 10, color: "var(--ink-3)" }}
      >
        Country-level pins. City precision is on the roadmap — visits
        log countries as free text rather than geocoded coordinates.
      </div>
    </div>
  );
}

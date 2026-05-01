import { Card } from "@/components/ui/card";
import { Anchor, ArrowRight } from "lucide-react";

interface Props {
  geojson: any;
  pol?: string | null;
  pod?: string | null;
}

/**
 * Renderização simplificada da rota do container.
 * Quando `geojson` está disponível, extrai as coordenadas (LineString) e
 * desenha em um SVG normalizado. POL/POD são marcados como âncoras.
 *
 * Mapa interativo (Leaflet/Mapbox) pode ser adicionado em fase 2.
 */
export function ContainerRouteMap({ geojson, pol, pod }: Props) {
  const coords = extractLineString(geojson);

  if (coords.length < 2) {
    return (
      <Card className="p-6 flex flex-col items-center justify-center gap-3 bg-muted/30 border-dashed">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Anchor className="h-4 w-4" />
          <span className="font-medium">{pol || "Origem"}</span>
          <ArrowRight className="h-4 w-4" />
          <span className="font-medium">{pod || "Destino"}</span>
          <Anchor className="h-4 w-4" />
        </div>
        <p className="text-xs text-muted-foreground">
          Rota geográfica não disponível ainda.
        </p>
      </Card>
    );
  }

  // Normaliza coordenadas (lon, lat) para um viewBox 0..1000 / 0..400
  const lons = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  const minLon = Math.min(...lons), maxLon = Math.max(...lons);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const w = 1000, h = 400, pad = 30;
  const sx = (lon: number) =>
    pad + ((lon - minLon) / Math.max(1e-6, maxLon - minLon)) * (w - pad * 2);
  const sy = (lat: number) =>
    h - (pad + ((lat - minLat) / Math.max(1e-6, maxLat - minLat)) * (h - pad * 2));

  const points = coords.map(([lon, lat]) => `${sx(lon)},${sy(lat)}`).join(" ");
  const start = coords[0];
  const end = coords[coords.length - 1];

  return (
    <Card className="p-3 bg-gradient-to-br from-blue-50 to-cyan-50">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto">
        <polyline
          points={points}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="3"
          strokeDasharray="6 4"
          strokeLinecap="round"
        />
        <circle cx={sx(start[0])} cy={sy(start[1])} r="8" fill="hsl(var(--primary))" />
        <text x={sx(start[0]) + 12} y={sy(start[1]) + 4} className="text-[14px] fill-foreground font-medium">
          {pol ?? "POL"}
        </text>
        <circle cx={sx(end[0])} cy={sy(end[1])} r="8" fill="hsl(var(--accent))" />
        <text
          x={sx(end[0]) - 12}
          y={sy(end[1]) + 4}
          textAnchor="end"
          className="text-[14px] fill-foreground font-medium"
        >
          {pod ?? "POD"}
        </text>
      </svg>
    </Card>
  );
}

function extractLineString(geojson: any): Array<[number, number]> {
  if (!geojson) return [];
  // Aceita Feature, FeatureCollection ou Geometry
  const features = geojson?.features ?? [geojson];
  for (const f of features) {
    const g = f?.geometry ?? f;
    if (g?.type === "LineString" && Array.isArray(g.coordinates)) {
      return g.coordinates as Array<[number, number]>;
    }
    if (g?.type === "MultiLineString" && Array.isArray(g.coordinates)) {
      return (g.coordinates as Array<Array<[number, number]>>).flat();
    }
  }
  return [];
}

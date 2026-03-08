// ─── api/client.ts ────────────────────────────────────────────────

import type { AnalyticsResponse, PrecioRow, TelemetryRow } from "./types";

const ROOT = document.getElementById("ic-root");
const ENV_API = import.meta.env.PUBLIC_API_BASE;
export const API_BASE: string = ENV_API ?? ROOT?.dataset.api ?? "http://localhost:8000";

// ── GET /health ───────────────────────────────────────────────────
export async function fetchHealth(): Promise<boolean> {
  const res = await fetch(`${API_BASE}/health`, {
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return true;
}

// ── GET /industrial/telemetria ────────────────────────────────────
export async function fetchTelemetry(): Promise<TelemetryRow[]> {
  const res = await fetch(`${API_BASE}/industrial/telemetria`, {
    signal: AbortSignal.timeout(4000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data) ? (data as TelemetryRow[]) : [];
}

// ── POST /industrial/generar-y-despachar ──────────────────────────
export async function fetchDispatch(
  email: string,
  nombre: string,
  filas: number
): Promise<Blob> {
  const url = `${API_BASE}/industrial/generar-y-despachar?email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre)}&filas=${filas}`;
  const res = await fetch(url, { method: "POST" });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error((errBody as { detail?: string }).detail ?? `Error ${res.status}`);
  }
  return res.blob();
}

// ── GET /estaciones/precios-actuales ─────────────────────────────
export async function fetchPrecios(localidad?: string): Promise<PrecioRow[]> {
  const url = localidad
    ? `${API_BASE}/surtidores/precios-actuales?localidad=${encodeURIComponent(localidad.toUpperCase())}`
    : `${API_BASE}/surtidores/precios-actuales`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<PrecioRow[]>;
}

// ── GET /analytics/comparativa-norte-pampeano ─────────────────────
export async function fetchAnalytics(producto: string): Promise<AnalyticsResponse> {
  const res = await fetch(
    `${API_BASE}/analytics/comparativa-norte-pampeano?producto=${encodeURIComponent(producto)}`
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<AnalyticsResponse>;
}

// ── GET /industrial/download-csv ──────────────────────────────────
export async function fetchCsvDownload(): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${API_BASE}/industrial/download-csv`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const blob = await res.blob();
  const cd = res.headers.get("content-disposition") ?? "";
  const match = cd.match(/filename="?([^";\n]+)"?/);
  return { blob, filename: match ? match[1] : "industrial_export.csv" };
}
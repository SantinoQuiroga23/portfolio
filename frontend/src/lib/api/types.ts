// ─── api/types.ts ─────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info";

export interface TelemetryRow {
  sensor: string;
  valor: number;
  unidad: string;
  estado: string;
}

export interface PrecioRow {
  producto: string | null;
  localidad: string | null;
  bandera: string | null;
  precio: number | null;
}

export interface HistoricoRow {
  fecha: string | null;
  localidad: string | null;
  bandera: string | null;
  producto: string | null;
  precio: number | null;
}

export interface MetricaRow {
  fecha: string | null;
  localidad: string | null;
  precio: number | null;
  aumento_nominal: number | null;
  aumento_porcentual: number | null;
}

export interface AnalyticsResponse {
  producto: string;
  metricas: MetricaRow[];
  count: number;
}

export interface DispatchStep {
  label: string;
  pct: number;
}

export interface SensorConfig {
  sensor: string;
  unidad: string;
  base: number;
  var: number;
  limit: number;
  alertaBaja: boolean;
}
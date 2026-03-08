// ─── api/renderers.ts ─────────────────────────────────────────────

import type { AnalyticsResponse, MetricaRow, PrecioRow, SensorConfig, TelemetryRow } from "./types";
import { getEl, pctArrow, pctClass } from "./utils";

// ── Telemetry ─────────────────────────────────────────────────────
const SENSORS_CONFIG: SensorConfig[] = [
  { sensor: "Temperatura Tanque Nafta", unidad: "°C",  base: 18.0,  var: 2.0, limit: 25.0,  alertaBaja: false },
  { sensor: "Presión Surtidor A",       unidad: "bar", base: 4.2,   var: 0.5, limit: 5.5,   alertaBaja: false },
  { sensor: "Stock Tanque Gasoil",      unidad: "%",   base: 65.0,  var: 0.2, limit: 15.0,  alertaBaja: true  },
  { sensor: "Tensión UPS Control",      unidad: "V",   base: 224.0, var: 5.0, limit: 210.0, alertaBaja: false },
];

export function mockTelemetry(): TelemetryRow[] {
  return SENSORS_CONFIG.map((s) => {
    const val = +(s.base + (Math.random() - 0.5) * s.var * 2).toFixed(2);
    let estado = "NOMINAL";
    if (s.alertaBaja) {
      if (val < s.limit)       estado = "ALERT";
      else if (val < s.limit + 10) estado = "WARNING";
    } else {
      if (val > s.limit)             estado = "ALERT";
      else if (val > s.limit - s.var * 0.5) estado = "WARNING";
    }
    return { sensor: s.sensor, valor: val, unidad: s.unidad, estado };
  });
}

function badgeClass(estado: string): string {
  if (estado === "ALERT")   return "ic-badge ic-badge--alert";
  if (estado === "WARNING") return "ic-badge ic-badge--warning";
  return "ic-badge ic-badge--nominal";
}

export function renderTelemetry(rows: TelemetryRow[]): void {
  const tbody = getEl("ic-telem-tbody");
  if (!tbody) return;

  const ts    = getEl("ic-telem-ts");
  const pulse = getEl("ic-telem-pulse");
  if (ts)    ts.textContent = new Date().toLocaleTimeString("es-AR");
  if (pulse) pulse.className = "ic-pulse-dot ic-pulse-dot--active";

  tbody.innerHTML = rows.map((r: TelemetryRow) => `
    <tr>
      <td><span style="font-family:var(--font-mono);font-size:0.72rem">${r.sensor}</span></td>
      <td><strong style="font-family:var(--font-mono)">${r.valor}</strong></td>
      <td><span style="font-family:var(--font-mono);color:var(--muted);font-size:0.7rem">${r.unidad}</span></td>
      <td><span class="${badgeClass(r.estado)}"><span class="ic-badge-dot"></span>${r.estado}</span></td>
    </tr>
  `).join("");
}

// ── Precios ───────────────────────────────────────────────────────
export function renderPrecios(data: PrecioRow[], container: HTMLElement): void {
  if (!data.length) {
    container.innerHTML = `<div class="ic-empty-state"><span>Sin datos para la selección actual</span></div>`;
    return;
  }
  container.innerHTML = data.slice(0, 20).map((row: PrecioRow) => `
    <div class="ic-price-row">
      <span class="ic-price-product">${row.producto ?? "—"}</span>
      <div class="ic-price-meta">
        <span class="ic-price-locality">${row.localidad ?? "—"}</span>
        <span class="ic-price-bandera">${row.bandera ?? "—"}</span>
        <span class="ic-price-value">$${Number(row.precio ?? 0).toFixed(2)}</span>
      </div>
    </div>
  `).join("");
}

// ── Analytics ─────────────────────────────────────────────────────
export function renderAnalytics(data: AnalyticsResponse, container: HTMLElement): void {
  const rows = data.metricas ?? [];
  if (!rows.length) {
    container.innerHTML = `<div class="ic-empty-state"><span>Sin datos para "${data.producto}"</span></div>`;
    return;
  }
  container.innerHTML = `
    <div class="ic-analytics-header">
      <span>Fecha</span><span>Localidad</span>
      <span style="text-align:right">Precio</span>
      <span style="text-align:right">Δ Nom.</span>
      <span style="text-align:right">Δ %</span>
    </div>
    ${rows.slice(0, 16).map((r: MetricaRow) => `
      <div class="ic-analytics-row">
        <span class="ic-analytics-fecha">${r.fecha?.slice(0, 10) ?? "—"}</span>
        <span class="ic-analytics-loc">${r.localidad ?? "—"}</span>
        <span class="ic-analytics-precio">$${r.precio ?? "—"}</span>
        <span class="ic-analytics-nom ${pctClass(r.aumento_nominal)}">
          ${r.aumento_nominal != null ? (r.aumento_nominal > 0 ? "+" : "") + r.aumento_nominal : "—"}
        </span>
        <span class="ic-analytics-pct ${pctClass(r.aumento_porcentual)}">
          ${pctArrow(r.aumento_porcentual)}
        </span>
      </div>
    `).join("")}
  `;
}
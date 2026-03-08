/* ══════════════════════════════════════════════════════════════════
   dashboard-logic.ts
   Toda la lógica del Panel de Control Industrial.
   Se importa como <script> en IndustrialControl.astro.
══════════════════════════════════════════════════════════════════ */

// ─── Types ────────────────────────────────────────────────────────
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

// Fila de /estaciones/precios-historicos
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

// Respuesta completa de GET /analytics/comparativa-norte-pampeano
export interface AnalyticsResponse {
  producto: string;
  metricas: MetricaRow[];
  count: number;
}

export interface DispatchStep {
  label: string;
  pct: number;
}

// ─── Element helpers ──────────────────────────────────────────────
function getEl(id: string): HTMLElement | null {
  return document.getElementById(id);
}
function getBtn(id: string): HTMLButtonElement | null {
  return document.getElementById(id) as HTMLButtonElement | null;
}
function getInput(id: string): HTMLInputElement | null {
  return document.getElementById(id) as HTMLInputElement | null;
}
function getSelect(id: string): HTMLSelectElement | null {
  return document.getElementById(id) as HTMLSelectElement | null;
}

// ─── Config ───────────────────────────────────────────────────────
const ROOT = document.getElementById("ic-root");
const API_BASE: string = ROOT?.dataset.api ?? "http://localhost:8000";
let backendOnline = false;

// ─── Toast ────────────────────────────────────────────────────────
const TOAST_ICONS: Record<ToastType, string> = {
  success: `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  error: `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info: `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
};

export function toast(type: ToastType, title: string, msg?: string): void {
  const container = getEl("ic-toast-container");
  if (!container) return;

  const el = document.createElement("div");
  el.className = `ic-toast ic-toast--${type}`;
  el.innerHTML = `
    ${TOAST_ICONS[type]}
    <div class="ic-toast-msg"><strong>${title}</strong>${msg ?? ""}</div>
  `;
  container.appendChild(el);

  setTimeout(() => {
    el.style.animation = "toastOut 0.3s ease forwards";
    setTimeout(() => el.remove(), 300);
  }, 4500);
}

// ─── Controls enable / disable ────────────────────────────────────
function setControlsEnabled(enabled: boolean): void {
  const btnIds: string[] = [
    "ic-dispatch-btn",
    "ic-prices-btn",
    "ic-download-btn",
    "ic-analytics-btn",
  ];
  const inputIds: string[] = ["ic-email", "ic-nombre", "ic-filas"];
  const selectIds: string[] = ["ic-localidad-select", "ic-producto-select"];

  btnIds.forEach((id) => {
    const el = getBtn(id);
    if (el) el.disabled = !enabled;
  });
  inputIds.forEach((id) => {
    const el = getInput(id);
    if (el) el.disabled = !enabled;
  });
  selectIds.forEach((id) => {
    const el = getSelect(id);
    if (el) el.disabled = !enabled;
  });
}

// ─── Clock ────────────────────────────────────────────────────────
function startClock(): void {
  const tick = (): void => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const el = getEl("ic-timestamp");
    if (el)
      el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ─── 1. Health check ──────────────────────────────────────────────
// GET /health → { "status": "ok" }
async function checkHealth(): Promise<void> {
  const led = getEl("ic-led");
  const text = getEl("ic-health-text");
  const banner = getEl("ic-offline-banner");

  if (led) led.className = "ic-led ic-led--checking";
  if (text) {
    text.textContent = "Verificando...";
    text.className = "ic-health-text";
  }

  try {
    const res = await fetch(`${API_BASE}/health`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    backendOnline = true;
    if (led) led.className = "ic-led ic-led--online";
    if (text) {
      text.textContent = "ONLINE";
      text.className = "ic-health-text ic-health-text--online";
    }
    if (banner) banner.classList.add("ic-hidden");
    setControlsEnabled(true);
  } catch {
    backendOnline = false;
    if (led) led.className = "ic-led ic-led--offline";
    if (text) {
      text.textContent = "OFFLINE";
      text.className = "ic-health-text ic-health-text--offline";
    }
    if (banner) banner.classList.remove("ic-hidden");
    setControlsEnabled(false);
  }
}

// ─── 2. Dispatch report ───────────────────────────────────────────
// POST /industrial/generar-y-despachar?email=&nombre=&filas=
// Responde con StreamingResponse (text/csv). El email se envía en background.
const DISPATCH_STEPS: DispatchStep[] = [
  { label: "Iniciando pipeline de datos...", pct: 15 },
  { label: "Consultando Polars / DuckDB...", pct: 35 },
  { label: "Generando datasets sintéticos...", pct: 55 },
  { label: "Llama 3.1 analizando métricas...", pct: 75 },
  { label: "Compilando reporte Excel...", pct: 90 },
  { label: "Despachando por SMTP...", pct: 100 },
];

function setDispatchLoading(loading: boolean): void {
  const btn = getBtn("ic-dispatch-btn");
  const content = getEl("ic-dispatch-btn-content");
  const log = getEl("ic-progress-log");
  const steps = getEl("ic-progress-steps");
  const bar = getEl("ic-progress-bar");

  if (!btn || !content || !log) return;

  if (loading) {
    btn.disabled = true;
    content.innerHTML = `<span class="ic-spinner"></span> Procesando...`;
    log.classList.remove("ic-hidden");
    if (steps) steps.innerHTML = "";
    if (bar) bar.style.width = "0%";

    DISPATCH_STEPS.forEach((step: DispatchStep, i: number) => {
      setTimeout(() => {
        if (bar) bar.style.width = `${step.pct}%`;
        if (steps) {
          const prev = steps.querySelector(".ic-progress-step--active");
          prev?.classList.replace(
            "ic-progress-step--active",
            "ic-progress-step--done"
          );
          const el = document.createElement("div");
          el.className = "ic-progress-step ic-progress-step--active";
          el.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg> ${step.label}`;
          steps.appendChild(el);
          steps.scrollTop = steps.scrollHeight;
        }
      }, i * 900);
    });
  } else {
    btn.disabled = false;
    content.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
      Generar y Despachar
    `;
  }
}

function initDispatchForm(): void {
  document
    .getElementById("ic-dispatch-form")
    ?.addEventListener("submit", async (e: Event) => {
      e.preventDefault();
      if (!backendOnline) return;

      const email = getInput("ic-email")?.value.trim() ?? "";
      const nombre = getInput("ic-nombre")?.value.trim() ?? "";
      const filas = parseInt(getInput("ic-filas")?.value ?? "500", 10);

      if (!email || !nombre) {
        toast(
          "error",
          "Campos incompletos",
          "Completá el email y el nombre del reporte."
        );
        return;
      }

      setDispatchLoading(true);

      try {
        // POST /industrial/generar-y-despachar?email=&nombre=&filas=
        const url = `${API_BASE}/industrial/generar-y-despachar?email=${encodeURIComponent(email)}&nombre=${encodeURIComponent(nombre)}&filas=${filas}`;
        const res = await fetch(url, { method: "POST" });

        if (!res.ok) {
          const errBody = await res
            .json()
            .catch(() => ({ detail: `HTTP ${res.status}` }));
          throw new Error(
            (errBody as { detail?: string }).detail ?? `Error ${res.status}`
          );
        }

        // El backend responde con StreamingResponse text/csv
        const blob = await res.blob();
        const objURL = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objURL;
        a.download = `${nombre}_sucio.csv`;
        a.click();
        URL.revokeObjectURL(objURL);

        toast("success", "Reporte despachado", `Enviado a ${email}. CSV descargándose.`);
      } catch (err) {
        toast(
          "error",
          "Error en pipeline",
          err instanceof Error ? err.message : "Error desconocido."
        );
      } finally {
        setTimeout(
          () => setDispatchLoading(false),
          DISPATCH_STEPS.length * 900 + 400
        );
      }
    });

  // Slider live value
  getInput("ic-filas")?.addEventListener("input", (e: Event) => {
    const val = getEl("ic-filas-value");
    if (val) val.textContent = (e.target as HTMLInputElement).value;
  });
}

// ─── 3. Telemetry ─────────────────────────────────────────────────
// GET /industrial/telemetria → TelemetryRow[]  (array directo, nunca { sensores: [] })
// Los labels del mock replican exactamente SENSORES_CONFIG["label"] del backend.
function mockTelemetry(): TelemetryRow[] {
  const sensors: Array<{
    sensor: string;    // igual a s["label"] en SENSORES_CONFIG del backend
    unidad: string;
    base: number;
    var: number;
    limit: number;
    alertaBaja: boolean; // true → alerta si valor < limit (ej: stock); false → si valor > limit
  }> = [
    {
      sensor: "Temperatura Tanque Nafta",
      unidad: "°C",
      base: 18.0,
      var: 2.0,
      limit: 25.0,
      alertaBaja: false,
    },
    {
      sensor: "Presión Surtidor A",
      unidad: "bar",
      base: 4.2,
      var: 0.5,
      limit: 5.5,
      alertaBaja: false,
    },
    {
      sensor: "Stock Tanque Gasoil",
      unidad: "%",
      base: 65.0,
      var: 0.2,
      limit: 15.0,
      alertaBaja: true,  // alerta cuando baja de 15%
    },
    {
      sensor: "Tensión UPS Control",
      unidad: "V",
      base: 224.0,
      var: 5.0,
      limit: 210.0,
      alertaBaja: false,
    },
  ];

  return sensors.map((s) => {
    const val = +(s.base + (Math.random() - 0.5) * s.var * 2).toFixed(2);
    let estado = "NOMINAL";
    if (s.alertaBaja) {
      if (val < s.limit) estado = "ALERT";
      else if (val < s.limit + 10) estado = "WARNING";
    } else {
      if (val > s.limit) estado = "ALERT";
      else if (val > s.limit - s.var * 0.5) estado = "WARNING";
    }
    return { sensor: s.sensor, valor: val, unidad: s.unidad, estado };
  });
}

function badgeClass(estado: string): string {
  if (estado === "ALERT") return "ic-badge ic-badge--alert";
  if (estado === "WARNING") return "ic-badge ic-badge--warning";
  return "ic-badge ic-badge--nominal";
}

function renderTelemetry(rows: TelemetryRow[]): void {
  const tbody = getEl("ic-telem-tbody");
  if (!tbody) return;

  const ts = getEl("ic-telem-ts");
  const pulse = getEl("ic-telem-pulse");
  if (ts) ts.textContent = new Date().toLocaleTimeString("es-AR");
  if (pulse) pulse.className = "ic-pulse-dot ic-pulse-dot--active";

  tbody.innerHTML = rows
    .map(
      (r: TelemetryRow) => `
    <tr>
      <td><span style="font-family:var(--font-mono);font-size:0.72rem">${r.sensor}</span></td>
      <td><strong style="font-family:var(--font-mono)">${r.valor}</strong></td>
      <td><span style="font-family:var(--font-mono);color:var(--muted);font-size:0.7rem">${r.unidad}</span></td>
      <td><span class="${badgeClass(r.estado)}"><span class="ic-badge-dot"></span>${r.estado}</span></td>
    </tr>
  `
    )
    .join("");
}

async function pollTelemetry(): Promise<void> {
  try {
    // GET /industrial/telemetria → TelemetryRow[] (array directo)
    const res = await fetch(`${API_BASE}/industrial/telemetria`, {
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) throw new Error();
    const data = await res.json();
    // El backend siempre devuelve un array directo
    renderTelemetry(Array.isArray(data) ? (data as TelemetryRow[]) : []);
  } catch {
    renderTelemetry(mockTelemetry());
  }
}

// ─── 4. Precios actuales ──────────────────────────────────────────
// GET /estaciones/precios-actuales?localidad= (opcional, se envía en uppercase)
function initPricesPanel(): void {
  getEl("ic-prices-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn = getBtn("ic-prices-btn");
    const container = getEl("ic-prices-container");
    const localidad = getSelect("ic-localidad-select")?.value ?? "";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="ic-spinner" style="border-top-color:var(--blue)"></span>`;
    }

    try {
      // GET /estaciones/precios-actuales?localidad= (opcional)
      // El backend hace .upper() internamente, pero lo enviamos ya en uppercase por consistencia
      const url = localidad
        ? `${API_BASE}/estaciones/precios-actuales?localidad=${encodeURIComponent(localidad.toUpperCase())}`
        : `${API_BASE}/estaciones/precios-actuales`;

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as PrecioRow[];

      if (!container) return;
      if (!data.length) {
        container.innerHTML = `<div class="ic-empty-state"><span>Sin datos para la selección actual</span></div>`;
        return;
      }

      container.innerHTML = data
        .slice(0, 20)
        .map(
          (row: PrecioRow) => `
        <div class="ic-price-row">
          <span class="ic-price-product">${row.producto ?? "—"}</span>
          <div class="ic-price-meta">
            <span class="ic-price-locality">${row.localidad ?? "—"}</span>
            <span class="ic-price-bandera">${row.bandera ?? "—"}</span>
            <span class="ic-price-value">$${Number(row.precio ?? 0).toFixed(2)}</span>
          </div>
        </div>
      `
        )
        .join("");
    } catch (err) {
      toast(
        "error",
        "Error al obtener precios",
        err instanceof Error ? err.message : "Falló la consulta."
      );
      if (container)
        container.innerHTML = `<div class="ic-empty-state"><span>Error al cargar datos</span></div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/>
          </svg> Actualizar`;
      }
    }
  });
}

// ─── 5. Analytics ─────────────────────────────────────────────────
// GET /analytics/comparativa-norte-pampeano?producto=
// Respuesta: { producto: string, metricas: MetricaRow[], count: number }
const pctClass = (v: number | null): string =>
  !v ? "ic-neutral" : v > 0 ? "ic-positive" : "ic-negative";
const pctArrow = (v: number | null): string =>
  !v ? "—" : v > 0 ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`;

function initAnalyticsPanel(): void {
  getEl("ic-analytics-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn = getBtn("ic-analytics-btn");
    const container = getEl("ic-analytics-container");
    const producto = getSelect("ic-producto-select")?.value ?? "NAFTA SUPER";

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="ic-spinner" style="border-top-color:var(--blue)"></span>`;
    }

    try {
      // GET /analytics/comparativa-norte-pampeano?producto=
      // El backend hace producto.upper() internamente con LIKE %producto%
      const res = await fetch(
        `${API_BASE}/analytics/comparativa-norte-pampeano?producto=${encodeURIComponent(producto)}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Respuesta tipada: { producto, metricas, count }
      const data = (await res.json()) as AnalyticsResponse;
      const rows = data.metricas ?? [];

      if (!container) return;
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
        ${rows
          .slice(0, 16)
          .map(
            (r: MetricaRow) => `
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
        `
          )
          .join("")}
      `;
    } catch (err) {
      toast(
        "error",
        "Error en analytics",
        err instanceof Error ? err.message : "Falló la consulta."
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
          </svg> Consultar`;
      }
    }
  });
}

// ─── 6. CSV Download ──────────────────────────────────────────────
// GET /industrial/download-csv
function initDownload(): void {
  getEl("ic-download-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn = getBtn("ic-download-btn");
    const label = getEl("ic-download-label");

    if (btn) btn.disabled = true;
    if (label) label.textContent = "Descargando...";

    try {
      // GET /industrial/download-csv
      const res = await fetch(`${API_BASE}/industrial/download-csv`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const blob = await res.blob();
      const objURL = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objURL;
      const cd = res.headers.get("content-disposition") ?? "";
      const match = cd.match(/filename="?([^";\n]+)"?/);
      a.download = match ? match[1] : "industrial_export.csv";
      a.click();
      URL.revokeObjectURL(objURL);
      toast("success", "CSV descargado", "Guardado en tu carpeta de descargas.");
    } catch (err) {
      toast(
        "error",
        "Error al descargar",
        err instanceof Error ? err.message : "Falló la descarga."
      );
    } finally {
      if (btn) btn.disabled = false;
      if (label) label.textContent = "Descargar CSV";
    }
  });
}

// ─── Init ─────────────────────────────────────────────────────────
startClock();
setControlsEnabled(false);
initDispatchForm();
initPricesPanel();
initAnalyticsPanel();
initDownload();

checkHealth().then(() => {
  if (backendOnline) pollTelemetry();
});

setInterval(checkHealth, 30_000);
setInterval(() => {
  if (backendOnline) pollTelemetry();
}, 5_000);

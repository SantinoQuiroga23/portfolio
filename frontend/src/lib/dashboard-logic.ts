/* ══════════════════════════════════════════════════════════════════
   dashboard-logic.ts
   Orquestador principal. Solo inicialización y handlers de UI.
   Toda la lógica de negocio vive en ./api/
══════════════════════════════════════════════════════════════════ */

import { fetchAnalytics, fetchCsvDownload, fetchDispatch, fetchHealth, fetchPrecios, fetchTelemetry } from "./api/client";
import { mockTelemetry, renderAnalytics, renderPrecios, renderTelemetry } from "./api/renderers";
import type { DispatchStep } from "./api/types";
import { getBtn, getEl, getInput, getSelect, setControlsEnabled, startClock, toast } from "./api/utils";

// ─── State ────────────────────────────────────────────────────────
let backendOnline = false;

// ─── 1. Health check ──────────────────────────────────────────────
async function checkHealth(): Promise<void> {
  const led    = getEl("ic-led");
  const text   = getEl("ic-health-text");
  const banner = getEl("ic-offline-banner");

  if (led)  led.className = "ic-led ic-led--checking";
  if (text) { text.textContent = "Verificando..."; text.className = "ic-health-text"; }

  try {
    await fetchHealth();
    backendOnline = true;
    if (led)    led.className = "ic-led ic-led--online";
    if (text)   { text.textContent = "ONLINE"; text.className = "ic-health-text ic-health-text--online"; }
    if (banner) banner.classList.add("ic-hidden");
    setControlsEnabled(true);
  } catch {
    backendOnline = false;
    if (led)    led.className = "ic-led ic-led--offline";
    if (text)   { text.textContent = "OFFLINE"; text.className = "ic-health-text ic-health-text--offline"; }
    if (banner) banner.classList.remove("ic-hidden");
    setControlsEnabled(false);
  }
}

// ─── 2. Dispatch ──────────────────────────────────────────────────
const DISPATCH_STEPS: DispatchStep[] = [
  { label: "Iniciando pipeline de datos...",    pct: 15  },
  { label: "Consultando Polars / DuckDB...",    pct: 35  },
  { label: "Generando datasets sintéticos...",  pct: 55  },
  { label: "Llama 3.1 analizando métricas...",  pct: 75  },
  { label: "Compilando reporte Excel...",        pct: 90  },
  { label: "Despachando por SMTP...",            pct: 100 },
];

function setDispatchLoading(loading: boolean): void {
  const btn     = getBtn("ic-dispatch-btn");
  const content = getEl("ic-dispatch-btn-content");
  const log     = getEl("ic-progress-log");
  const steps   = getEl("ic-progress-steps");
  const bar     = getEl("ic-progress-bar");

  if (!btn || !content || !log) return;

  if (loading) {
    btn.disabled = true;
    content.innerHTML = `<span class="ic-spinner"></span> Procesando...`;
    log.classList.remove("ic-hidden");
    if (steps) steps.innerHTML = "";
    if (bar)   bar.style.width = "0%";

    DISPATCH_STEPS.forEach((step: DispatchStep, i: number) => {
      setTimeout(() => {
        if (bar) bar.style.width = `${step.pct}%`;
        if (steps) {
          steps.querySelector(".ic-progress-step--active")
            ?.classList.replace("ic-progress-step--active", "ic-progress-step--done");
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
  document.getElementById("ic-dispatch-form")?.addEventListener("submit", async (e: Event) => {
    e.preventDefault();
    if (!backendOnline) return;

    const email  = getInput("ic-email")?.value.trim()  ?? "";
    const nombre = getInput("ic-nombre")?.value.trim() ?? "";
    const filas  = parseInt(getInput("ic-filas")?.value ?? "500", 10);

    if (!email || !nombre) {
      toast("error", "Campos incompletos", "Completá el email y el nombre del reporte.");
      return;
    }

    setDispatchLoading(true);
    try {
      const blob   = await fetchDispatch(email, nombre, filas);
      const objURL = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = objURL;
      a.download   = `${nombre}_sucio.csv`;
      a.click();
      URL.revokeObjectURL(objURL);
      toast("success", "Reporte despachado", `Enviado a ${email}. CSV descargándose.`);
    } catch (err) {
      toast("error", "Error en pipeline", err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setTimeout(() => setDispatchLoading(false), DISPATCH_STEPS.length * 900 + 400);
    }
  });

  getInput("ic-filas")?.addEventListener("input", (e: Event) => {
    const val = getEl("ic-filas-value");
    if (val) val.textContent = (e.target as HTMLInputElement).value;
  });
}

// ─── 3. Telemetry ─────────────────────────────────────────────────
async function pollTelemetry(): Promise<void> {
  try {
    const data = await fetchTelemetry();
    renderTelemetry(data);
  } catch {
    renderTelemetry(mockTelemetry());
  }
}

// ─── 4. Precios ───────────────────────────────────────────────────
function initPricesPanel(): void {
  getEl("ic-prices-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn       = getBtn("ic-prices-btn");
    const container = getEl("ic-prices-container");
    const localidad = getSelect("ic-localidad-select")?.value;

    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="ic-spinner" style="border-top-color:var(--blue)"></span>`; }

    try {
      const data = await fetchPrecios(localidad);
      if (container) renderPrecios(data, container);
    } catch (err) {
      toast("error", "Error al obtener precios", err instanceof Error ? err.message : "Falló la consulta.");
      if (container) container.innerHTML = `<div class="ic-empty-state"><span>Error al cargar datos</span></div>`;
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.54"/></svg> Actualizar`;
      }
    }
  });
}

// ─── 5. Analytics ─────────────────────────────────────────────────
function initAnalyticsPanel(): void {
  getEl("ic-analytics-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn       = getBtn("ic-analytics-btn");
    const container = getEl("ic-analytics-container");
    const producto  = getSelect("ic-producto-select")?.value ?? "NAFTA SUPER";

    if (btn) { btn.disabled = true; btn.innerHTML = `<span class="ic-spinner" style="border-top-color:var(--blue)"></span>`; }

    try {
      const data = await fetchAnalytics(producto);
      if (container) renderAnalytics(data, container);
    } catch (err) {
      toast("error", "Error en analytics", err instanceof Error ? err.message : "Falló la consulta.");
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> Consultar`;
      }
    }
  });
}

// ─── 6. CSV Download ──────────────────────────────────────────────
function initDownload(): void {
  getEl("ic-download-btn")?.addEventListener("click", async () => {
    if (!backendOnline) return;

    const btn   = getBtn("ic-download-btn");
    const label = getEl("ic-download-label");

    if (btn)   btn.disabled = true;
    if (label) label.textContent = "Descargando...";

    try {
      const { blob, filename } = await fetchCsvDownload();
      const objURL = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href       = objURL;
      a.download   = filename;
      a.click();
      URL.revokeObjectURL(objURL);
      toast("success", "CSV descargado", "Guardado en tu carpeta de descargas.");
    } catch (err) {
      toast("error", "Error al descargar", err instanceof Error ? err.message : "Falló la descarga.");
    } finally {
      if (btn)   btn.disabled = false;
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

checkHealth().then(() => { if (backendOnline) pollTelemetry(); });

setInterval(checkHealth, 30_000);
setInterval(() => { if (backendOnline) pollTelemetry(); }, 5_000);
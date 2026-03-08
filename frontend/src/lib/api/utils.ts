// ─── api/utils.ts ─────────────────────────────────────────────────

import type { ToastType } from "./types";

// ── DOM helpers ───────────────────────────────────────────────────
export const getEl     = (id: string): HTMLElement | null       => document.getElementById(id);
export const getBtn    = (id: string): HTMLButtonElement | null => document.getElementById(id) as HTMLButtonElement | null;
export const getInput  = (id: string): HTMLInputElement | null  => document.getElementById(id) as HTMLInputElement | null;
export const getSelect = (id: string): HTMLSelectElement | null => document.getElementById(id) as HTMLSelectElement | null;

// ── Toast ─────────────────────────────────────────────────────────
const TOAST_ICONS: Record<ToastType, string> = {
  success: `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>`,
  error:   `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
  info:    `<svg class="ic-toast-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
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

// ── Clock ─────────────────────────────────────────────────────────
export function startClock(): void {
  const tick = (): void => {
    const now = new Date();
    const pad = (n: number): string => String(n).padStart(2, "0");
    const el = getEl("ic-timestamp");
    if (el) el.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  };
  tick();
  setInterval(tick, 1000);
}

// ── Controls enable / disable ─────────────────────────────────────
export function setControlsEnabled(enabled: boolean): void {
  const btnIds    = ["ic-dispatch-btn", "ic-prices-btn", "ic-download-btn", "ic-analytics-btn"];
  const inputIds  = ["ic-email", "ic-nombre", "ic-filas"];
  const selectIds = ["ic-localidad-select", "ic-producto-select"];

  btnIds.forEach((id)    => { const el = getBtn(id);    if (el) el.disabled = !enabled; });
  inputIds.forEach((id)  => { const el = getInput(id);  if (el) el.disabled = !enabled; });
  selectIds.forEach((id) => { const el = getSelect(id); if (el) el.disabled = !enabled; });
}

// ── Percentage helpers (analytics) ───────────────────────────────
export const pctClass = (v: number | null): string =>
  !v ? "ic-neutral" : v > 0 ? "ic-positive" : "ic-negative";

export const pctArrow = (v: number | null): string =>
  !v ? "—" : v > 0 ? `▲ ${v}%` : `▼ ${Math.abs(v)}%`;
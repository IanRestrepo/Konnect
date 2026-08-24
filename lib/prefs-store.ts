import { DEFAULT_PREFERENCES, STORAGE_KEY, type Preferences } from "@/lib/theme";

/**
 * Store externo mínimo para las preferencias, consumible con useSyncExternalStore.
 * Vive fuera de React porque también escribe atributos en <html>.
 */

let snapshot: Preferences = DEFAULT_PREFERENCES;
let hydrated = false;
const listeners = new Set<() => void>();

function read(): Preferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...(JSON.parse(raw) as Partial<Preferences>) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function resolveMode(mode: Preferences["mode"]): "light" | "dark" {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyToDocument(prefs: Preferences, animate = false) {
  const root = document.documentElement;
  if (animate) root.setAttribute("data-theme-transition", "");
  root.setAttribute("data-theme", resolveMode(prefs.mode));
  root.setAttribute("data-accent", prefs.accent);
  root.setAttribute("data-density", prefs.density);
  if (animate) window.setTimeout(() => root.removeAttribute("data-theme-transition"), 220);
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): Preferences {
  if (!hydrated) {
    snapshot = read();
    hydrated = true;
  }
  return snapshot;
}

export function getServerSnapshot(): Preferences {
  return DEFAULT_PREFERENCES;
}

export function setPreferences(patch: Partial<Preferences>) {
  snapshot = { ...getSnapshot(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // almacenamiento no disponible
  }
  applyToDocument(snapshot, true);
  listeners.forEach((l) => l());
}

/** Reaplica el tema cuando el sistema cambia y el modo es "system". */
export function watchSystemTheme() {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = () => {
    if (getSnapshot().mode !== "system") return;
    applyToDocument(getSnapshot());
    listeners.forEach((l) => l());
  };
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

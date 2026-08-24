export const ACCENTS = [
  { id: "konnect", label: "Konnect", swatch: "#0046d9" },
  { id: "indigo", label: "Índigo", swatch: "#4f46e5" },
  { id: "violeta", label: "Violeta", swatch: "#7c3aed" },
  { id: "azul", label: "Azul", swatch: "#1d69d4" },
  { id: "verde", label: "Verde", swatch: "#15794a" },
  { id: "ambar", label: "Ámbar", swatch: "#b45309" },
  { id: "rosa", label: "Rosa", swatch: "#be185d" },
  { id: "tinta", label: "Tinta", swatch: "#26262d" },
] as const;

export type AccentId = (typeof ACCENTS)[number]["id"];
export type ThemeMode = "light" | "dark" | "system";

export type Preferences = {
  mode: ThemeMode;
  accent: AccentId;
  /** `comoda` centra el contenido a 1120px; `compacta` lo ensancha a 1400px. */
  density: "comoda" | "compacta";
};

export const DEFAULT_PREFERENCES: Preferences = {
  mode: "light",
  accent: "konnect",
  density: "comoda",
};

export const STORAGE_KEY = "konnect.prefs";

/** Script inline: aplica preferencias antes del primer paint (evita flash). */
export const THEME_SCRIPT = `(function(){try{
var d=document.documentElement;
var p=JSON.parse(localStorage.getItem(${JSON.stringify(STORAGE_KEY)})||"{}");
var mode=p.mode||${JSON.stringify(DEFAULT_PREFERENCES.mode)};
var resolved=mode==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):mode;
d.setAttribute("data-theme",resolved);
d.setAttribute("data-accent",p.accent||${JSON.stringify(DEFAULT_PREFERENCES.accent)});
d.setAttribute("data-density",p.density||${JSON.stringify(DEFAULT_PREFERENCES.density)});
}catch(e){}})();`;

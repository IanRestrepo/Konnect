"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  applyToDocument,
  getServerSnapshot,
  getSnapshot,
  resolveMode,
  setPreferences,
  subscribe,
  watchSystemTheme,
} from "@/lib/prefs-store";
import type { Preferences } from "@/lib/theme";

const ATRIBUTOS = ["data-theme", "data-accent", "data-density"];

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => watchSystemTheme(), []);

  /*
   * Vigila que nadie le quite el tema a <html>.
   *
   * Quitar `data-theme` de las props del layout no bastó: cuando React 19
   * vuelve a montar la raíz —una hidratación que no cuadra, una página de
   * error—, suelta el <html> borrándole todos los atributos, también los que
   * nunca declaró. THEME_SCRIPT solo corre al cargar, así que la pantalla se
   * quedaba en claro hasta recargar. En vez de perseguir cada causa, se
   * reaplica la preferencia en cuanto alguno de los tres atributos cambia sin
   * que la haya cambiado el usuario.
   */
  useEffect(() => {
    const root = document.documentElement;
    const reponer = () => {
      const prefs = getSnapshot();
      const esperado = {
        "data-theme": resolveMode(prefs.mode),
        "data-accent": prefs.accent,
        "data-density": prefs.density,
      } as Record<string, string>;
      // Solo si difiere: aplicar dispara el observador otra vez, y así no
      // entra en bucle.
      if (ATRIBUTOS.some((a) => root.getAttribute(a) !== esperado[a])) {
        applyToDocument(prefs);
      }
    };
    reponer();
    const observador = new MutationObserver(reponer);
    observador.observe(root, { attributes: true, attributeFilter: ATRIBUTOS });
    return () => observador.disconnect();
  }, []);

  return <>{children}</>;
}

export function usePreferences() {
  const prefs = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return {
    prefs,
    setPrefs: (patch: Partial<Preferences>) => setPreferences(patch),
    resolvedMode: resolveMode(prefs.mode),
  };
}

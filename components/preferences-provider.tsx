"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  getServerSnapshot,
  getSnapshot,
  resolveMode,
  setPreferences,
  subscribe,
  watchSystemTheme,
} from "@/lib/prefs-store";
import type { Preferences } from "@/lib/theme";

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => watchSystemTheme(), []);
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

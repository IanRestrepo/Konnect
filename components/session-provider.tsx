"use client";

import { createContext, useContext } from "react";
import type { SessionPayload } from "@/lib/auth";
import { hasPermission, isDeveloper, type PermissionId } from "@/lib/permissions";

type Contexto = {
  session: SessionPayload | null;
  /** Módulos apagados por el desarrollador. Pesan más que cualquier permiso. */
  disabledModules: string[];
};

const SessionContext = createContext<Contexto>({ session: null, disabledModules: [] });

export function SessionProvider({
  session,
  disabledModules = [],
  children,
}: {
  session: SessionPayload | null;
  disabledModules?: string[];
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={{ session, disabledModules }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext).session;
}

/**
 * `can("ver_finanzas")` en cliente, para ocultar lo que el rol no permite.
 * Un módulo apagado por el desarrollador se oculta aunque el rol lo permita;
 * él es el único que lo sigue viendo, para poder reactivarlo.
 */
export function useCan() {
  const { session, disabledModules } = useContext(SessionContext);
  const soyDev = isDeveloper(session?.permissions);

  return (permission: PermissionId) => {
    if (!soyDev && disabledModules.includes(permission)) return false;
    return hasPermission(session?.permissions, permission);
  };
}

/** Para pintar lo que solo existe para el desarrollador. */
export function useIsDeveloper() {
  return isDeveloper(useContext(SessionContext).session?.permissions);
}

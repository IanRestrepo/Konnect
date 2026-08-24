"use client";

import { createContext, useContext } from "react";
import type { SessionPayload } from "@/lib/auth";
import { hasPermission, type PermissionId } from "@/lib/permissions";

const SessionContext = createContext<SessionPayload | null>(null);

export function SessionProvider({
  session,
  children,
}: {
  session: SessionPayload | null;
  children: React.ReactNode;
}) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession() {
  return useContext(SessionContext);
}

/** `can("ver_finanzas")` en cliente, para ocultar lo que el rol no permite. */
export function useCan() {
  const session = useContext(SessionContext);
  return (permission: PermissionId) => hasPermission(session?.permissions, permission);
}

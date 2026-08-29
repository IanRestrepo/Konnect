/**
 * Catálogo de permisos. Cada permiso es una llave estable: los roles guardan
 * llaves, no rutas, para que renombrar una página no rompa los accesos.
 */

export const PERMISSIONS = [
  {
    id: "ver_panel",
    label: "Panel",
    description: "Resumen general de la agencia",
    group: "Páginas",
    href: "/",
  },
  {
    id: "ver_creadores",
    label: "Creadores",
    description: "Fichas de creadores y sus tarifas",
    group: "Páginas",
    href: "/creadores",
  },
  {
    id: "ver_campanas",
    label: "Campañas",
    description: "Campañas, entregables y métricas",
    group: "Páginas",
    href: "/campanas",
  },
  {
    id: "ver_empresas",
    label: "Empresas",
    description: "Clientes que contratan",
    group: "Páginas",
    href: "/empresas",
  },
  {
    id: "ver_mensajes",
    label: "Mensajes",
    description: "Bandeja de correo de la agencia",
    group: "Páginas",
    href: "/mensajes",
  },
  {
    id: "ver_finanzas",
    label: "Finanzas",
    description: "Cobros, pagos y margen",
    group: "Páginas",
    href: "/finanzas",
  },
  {
    id: "ver_chat",
    label: "Chat",
    description: "Salas de conversación del equipo",
    group: "Páginas",
    href: "/chat",
  },
  {
    id: "ver_sesiones",
    label: "Sesiones",
    description: "Espacios de entrega compartidos con creadores y clientes",
    group: "Páginas",
    href: "/sesiones",
  },
  {
    id: "ver_datos_bancarios",
    label: "Ver datos bancarios",
    description: "Revelar la información de pago de los creadores (además pide el código)",
    group: "Datos sensibles",
    href: null,
  },
  {
    id: "editar_creadores",
    label: "Crear y editar creadores",
    description: "Alta y modificación de fichas",
    group: "Acciones",
    href: null,
  },
  {
    id: "editar_campanas",
    label: "Crear y editar campañas",
    description: "Alta de campañas y entregables",
    group: "Acciones",
    href: null,
  },
  {
    id: "editar_empresas",
    label: "Crear y editar empresas",
    description: "Alta y modificación de clientes",
    group: "Acciones",
    href: null,
  },
  {
    id: "gestionar_chat",
    label: "Gestionar salas de chat",
    description: "Crear, renombrar y archivar salas, y borrar cualquier mensaje",
    group: "Administración",
    href: null,
  },
  {
    id: "editar_sesiones",
    label: "Gestionar sesiones de entrega",
    description: "Crear sesiones, repartir códigos de acceso y subir material",
    group: "Acciones",
    href: null,
  },
  {
    id: "gestionar_usuarios",
    label: "Gestionar usuarios y roles",
    description: "Crear cuentas, asignar roles y definir permisos",
    group: "Administración",
    href: null,
  },
  {
    id: "gestionar_ajustes",
    label: "Configuración de la agencia",
    description: "Integraciones, seguridad y datos de la organización",
    group: "Administración",
    href: null,
  },
] as const;

export type PermissionId = (typeof PERMISSIONS)[number]["id"];

export const PERMISSION_GROUPS = ["Páginas", "Acciones", "Datos sensibles", "Administración"] as const;

/** Comodín del rol de administración: concede todo, presente y futuro. */
export const ALL_PERMISSIONS = "*" as const;

/**
 * Comodín del desarrollador. Pesa más que el de administración: pasa por
 * encima de los módulos apagados y es el único que puede tocar el propio rol
 * de desarrollador. La administración de la agencia no puede concederlo.
 */
export const DEVELOPER = "**" as const;

/** Identificador del rol reservado. No se puede editar ni eliminar. */
export const DEVELOPER_ROLE_ID = "rol_developer";

export type RolePermissions =
  | PermissionId[]
  | [typeof ALL_PERMISSIONS]
  | [typeof DEVELOPER];

/** Las llaves del catálogo, en el orden en que se muestran. */
export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id) as [PermissionId, ...PermissionId[]];

export function isPermissionId(value: string): value is PermissionId {
  return (PERMISSION_IDS as readonly string[]).includes(value);
}

/**
 * Lo que un rol puede tener guardado: una llave del catálogo o uno de los dos
 * comodines. Los roles del sistema guardan comodines, así que validar solo
 * contra el catálogo los daba por inválidos.
 */
export function isRolePermission(value: string): boolean {
  return value === ALL_PERMISSIONS || value === DEVELOPER || isPermissionId(value);
}

/** Concede el catálogo entero: administración o desarrollador. */
export function grantsEverything(permissions: readonly string[] | undefined): boolean {
  return Boolean(
    permissions?.includes(ALL_PERMISSIONS) || permissions?.includes(DEVELOPER),
  );
}

/**
 * Forma canónica de la lista: un comodín manda solo, y lo repetido o
 * desconocido se cae. Así nunca se guarda ["*", "ver_panel"].
 */
export function normalizeRolePermissions(permissions: readonly string[]): string[] {
  if (permissions.includes(DEVELOPER)) return [DEVELOPER];
  if (permissions.includes(ALL_PERMISSIONS)) return [ALL_PERMISSIONS];
  return catalogPermissions(permissions);
}

/** Solo las llaves del catálogo, sin comodines: lo que marca la interfaz. */
export function catalogPermissions(
  permissions: readonly string[] | undefined,
): PermissionId[] {
  return PERMISSION_IDS.filter((id) => permissions?.includes(id) ?? false);
}

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: PermissionId,
): boolean {
  if (!permissions) return false;
  return grantsEverything(permissions) || permissions.includes(permission);
}

/** Quien lo tenga manda sobre todo lo demás, incluidos los administradores. */
export function isDeveloper(permissions: readonly string[] | undefined): boolean {
  return Boolean(permissions?.includes(DEVELOPER));
}

/** Ruta protegida → permiso que la habilita. */
const ROUTE_PERMISSION: { prefix: string; permission: PermissionId }[] = [
  { prefix: "/creadores", permission: "ver_creadores" },
  { prefix: "/campanas", permission: "ver_campanas" },
  { prefix: "/empresas", permission: "ver_empresas" },
  { prefix: "/mensajes", permission: "ver_mensajes" },
  { prefix: "/finanzas", permission: "ver_finanzas" },
  { prefix: "/sesiones", permission: "ver_sesiones" },
  { prefix: "/chat", permission: "ver_chat" },
  { prefix: "/configuracion", permission: "gestionar_ajustes" },
];

export function permissionForPath(pathname: string): PermissionId | null {
  if (pathname === "/") return "ver_panel";
  const match = ROUTE_PERMISSION.find((r) => pathname.startsWith(r.prefix));
  return match?.permission ?? null;
}

/** Primera página que el usuario sí puede abrir, para redirigirlo ahí. */
export function firstAllowedPath(permissions: readonly string[] | undefined): string {
  if (hasPermission(permissions, "ver_panel")) return "/";
  const page = PERMISSIONS.find(
    (p) => p.href && hasPermission(permissions, p.id as PermissionId),
  );
  return page?.href ?? "/sin-acceso";
}

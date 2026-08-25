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

export type RolePermissions = PermissionId[] | [typeof ALL_PERMISSIONS];

export function hasPermission(
  permissions: readonly string[] | undefined,
  permission: PermissionId,
): boolean {
  if (!permissions) return false;
  return permissions.includes(ALL_PERMISSIONS) || permissions.includes(permission);
}

/** Ruta protegida → permiso que la habilita. */
const ROUTE_PERMISSION: { prefix: string; permission: PermissionId }[] = [
  { prefix: "/creadores", permission: "ver_creadores" },
  { prefix: "/campanas", permission: "ver_campanas" },
  { prefix: "/empresas", permission: "ver_empresas" },
  { prefix: "/mensajes", permission: "ver_mensajes" },
  { prefix: "/finanzas", permission: "ver_finanzas" },
  { prefix: "/sesiones", permission: "ver_sesiones" },
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

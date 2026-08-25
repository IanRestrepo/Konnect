import {
  Building2,
  FolderKanban,
  House,
  Mail,
  Megaphone,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { PermissionId } from "@/lib/permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: PermissionId;
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Inicio", icon: House, permission: "ver_panel" },
  { href: "/creadores", label: "Creadores", icon: Users, permission: "ver_creadores" },
  { href: "/campanas", label: "Campañas", icon: Megaphone, permission: "ver_campanas" },
  { href: "/empresas", label: "Empresas", icon: Building2, permission: "ver_empresas" },
  { href: "/sesiones", label: "Sesiones", icon: FolderKanban, permission: "ver_sesiones" },
  { href: "/mensajes", label: "Mensajes", icon: Mail, permission: "ver_mensajes" },
  { href: "/finanzas", label: "Finanzas", icon: Wallet, permission: "ver_finanzas" },
];

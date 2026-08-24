import { requirePermission } from "@/lib/session";
import { MessagesView } from "@/app/mensajes/messages-view";

export const metadata = { title: "Mensajes — Konnect" };

export default async function MensajesPage() {
  await requirePermission("ver_mensajes");
  return <MessagesView />;
}

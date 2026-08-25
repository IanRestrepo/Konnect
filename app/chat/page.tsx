import { requirePermission } from "@/lib/session";
import { canSeeRoom, listRooms, listMessages, listRoles } from "@/lib/store";
import { ChatView } from "@/app/chat/chat-view";

export const metadata = { title: "Chat — Konnect" };

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ sala?: string }>;
}) {
  const session = await requirePermission("ver_chat");
  const { sala } = await searchParams;

  const todas = await listRooms();
  const rooms = todas.filter((r) => canSeeRoom(r, session.roleId, session.permissions));

  // La sala pedida, o la primera activa con la que se pueda empezar a hablar.
  const activa =
    rooms.find((r) => r.id === sala) ?? rooms.find((r) => !r.archived) ?? rooms[0] ?? null;

  const [messages, roles] = await Promise.all([
    activa ? listMessages(activa.id) : Promise.resolve([]),
    listRoles(),
  ]);

  return (
    <ChatView
      rooms={rooms}
      activeRoomId={activa?.id ?? null}
      initialMessages={messages}
      roles={roles.map((r) => ({ id: r.id, name: r.name, color: r.color }))}
      me={{ id: session.userId, name: session.name }}
    />
  );
}

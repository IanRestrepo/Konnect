"use client";

import { createElement } from "react";
import { chatIcon } from "@/lib/chat-icons";

/**
 * Pinta el icono elegido para una sala a partir de su nombre guardado.
 *
 * Se resuelve con `createElement` en vez de asignar el componente a una
 * variable dentro del render: así React no lo confunde con un componente
 * declarado al vuelo, que remontaría en cada pasada.
 */
export function RoomIcon({
  name,
  size = 15,
  className,
  style,
}: {
  name: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return createElement(chatIcon(name), { size, strokeWidth: 2, className, style });
}

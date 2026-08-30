"use client";

/**
 * Script en línea que se ejecuta al parsear el HTML sin disparar el aviso de
 * desarrollo de React («Encountered a script tag while rendering React
 * component»).
 *
 * En el servidor se emite como `text/javascript` y el navegador lo corre antes
 * del primer pintado. En el cliente se emite como `text/plain` —inerte— para
 * que React no lo marque; `suppressHydrationWarning` absorbe la diferencia de
 * `type` al hidratar.
 *
 * Patrón tomado de
 * node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

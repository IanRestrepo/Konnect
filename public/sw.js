/*
 * Service worker de Konnect: solo para los avisos push del equipo.
 *
 * No guarda nada en caché a propósito. La aplicación cambia con cada subida a
 * producción, y un service worker que sirve páginas viejas es la forma más
 * fácil de que alguien trabaje sobre datos de ayer sin saberlo.
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let aviso = {};
  try {
    aviso = event.data ? event.data.json() : {};
  } catch {
    aviso = { title: "Konnect", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(aviso.title || "Konnect", {
      body: aviso.body || "",
      icon: "/brand/app-192.png",
      badge: "/brand/app-192.png",
      tag: aviso.tag,
      // Un recordatorio con la misma etiqueta sustituye al anterior, pero
      // vuelve a sonar y vibrar: es justo lo que tiene que hacer.
      renotify: Boolean(aviso.tag),
      // Se queda en pantalla hasta que alguien lo toca o lo descarta.
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: aviso.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destino = new URL(event.notification.data?.url || "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const ventanas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Si la aplicación ya está abierta, se usa esa pestaña en vez de abrir otra.
      for (const v of ventanas) {
        if (new URL(v.url).origin === self.location.origin && "focus" in v) {
          await v.focus();
          if ("navigate" in v) await v.navigate(destino);
          return;
        }
      }
      await self.clients.openWindow(destino);
    })(),
  );
});

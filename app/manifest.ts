import type { MetadataRoute } from "next";

/**
 * Manifiesto de la aplicación.
 *
 * Hace falta para los avisos en el teléfono: en iPhone, el push solo funciona
 * si la aplicación se añadió a la pantalla de inicio, y eso pide manifiesto.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Konnect",
    short_name: "Konnect",
    start_url: "/",
    display: "standalone",
    background_color: "#0f1115",
    theme_color: "#0f1115",
    lang: "es",
    icons: [
      { src: "/brand/app-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/app-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}

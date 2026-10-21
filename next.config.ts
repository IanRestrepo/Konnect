import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // BlackBull lee las fuentes del disco con `node:fs`, y el rastreo de archivos
  // no ve esa lectura: sin esto la función se empaqueta sin Poppins y el PDF
  // sale en Helvetica.
  outputFileTracingIncludes: {
    "/api/creadores/\\[id\\]/media-kit": [
      "./node_modules/@fontsource/poppins/files/poppins-latin-*-normal.woff",
    ],
  },

  // El service worker de los avisos no se guarda en caché: si se quedara una
  // versión vieja, los cambios en cómo se enseña un aviso no llegarían nunca.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;

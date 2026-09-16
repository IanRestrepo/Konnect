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
};

export default nextConfig;

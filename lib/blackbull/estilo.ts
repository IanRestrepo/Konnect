import fs from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

/* ---------------- Tipografía ---------------- */

const PESOS = [400, 500, 600, 700] as const;

/**
 * Registra Poppins desde el paquete de npm, no desde Google: pedir la fuente a
 * otro servidor en cada PDF añade una espera y un punto de fallo. Si los
 * archivos no están —la función se empaquetó sin ellos—, se cae a Helvetica
 * en vez de romper el documento.
 */
function registrarFuentes(): string {
  const carpeta = path.join(process.cwd(), "node_modules", "@fontsource", "poppins", "files");
  const archivos = PESOS.map((peso) => ({
    peso,
    ruta: path.join(carpeta, `poppins-latin-${peso}-normal.woff`),
  }));
  if (!archivos.every((a) => fs.existsSync(a.ruta))) return "Helvetica";

  Font.register({
    family: "Poppins",
    fonts: archivos.map((a) => ({ src: a.ruta, fontWeight: a.peso })),
  });
  // Sin cortes de palabra con guiones: en español parten mal los nombres.
  Font.registerHyphenationCallback((palabra) => [palabra]);
  return "Poppins";
}

export const FAMILIA = registrarFuentes();

/* ---------------- Paleta ---------------- */

/** Los mismos tonos que la aplicación: un solo acento, usado poco. */
export const C = {
  noche: "#0e0e11",
  nocheSuave: "#17171b",
  lineaNoche: "#2a2a31",
  papel: "#ffffff",
  lienzo: "#f1f1f4",
  texto: "#16161a",
  suave: "#6c6c78",
  tenue: "#a0a0ae",
  linea: "#e6e6ec",
  acento: "#0046d9",
  acentoSuave: "#e5edfb",
  ok: "#17803d",
};

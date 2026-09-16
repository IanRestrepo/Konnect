import fs from "node:fs";
import path from "node:path";
import {
  Document,
  Font,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { MediaKitData } from "@/lib/blackbull/datos";

/**
 * BlackBull Engine: el motor de PDF de Konnect.
 *
 * Dibuja documentos con \`@react-pdf/renderer\` directamente en el servidor, sin
 * abrir un navegador por detrás. Un Chrome sin cabeza en una función de Vercel
 * tarda en arrancar, pesa más de lo que admite la función y se cae con la
 * memoria; esto es JavaScript puro y sale en un par de segundos.
 *
 * Por ahora genera el media kit del creador. Lo que no depende del documento
 * —fuentes, colores, imágenes— vive aquí para que el siguiente documento lo
 * reutilice.
 */

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

const FAMILIA = registrarFuentes();

/* ---------------- Paleta ---------------- */

/** Los mismos tonos que la aplicación: un solo acento, usado poco. */
const C = {
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

/* ---------------- Imágenes ---------------- */

type Imagen = { data: Buffer; format: "png" | "jpg" } | null;

/**
 * Descarga una imagen para meterla en el PDF.
 *
 * Con tiempo límite y sin lanzar: una miniatura que no carga deja su hueco,
 * no tumba el media kit entero. Solo PNG y JPEG, que es lo que sabe pintar el
 * motor; un WebP se salta.
 */
async function traerImagen(url: string | null): Promise<Imagen> {
  if (!url) return null;
  try {
    const control = new AbortController();
    const reloj = setTimeout(() => control.abort(), 5000);
    const res = await fetch(url, { signal: control.signal });
    clearTimeout(reloj);
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data[0] === 0x89 && data[1] === 0x50) return { data, format: "png" };
    if (data[0] === 0xff && data[1] === 0xd8) return { data, format: "jpg" };
    return null;
  } catch {
    return null;
  }
}

/* ---------------- Formato ---------------- */

const compacto = new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 });
/**
 * Cifras cortas. Por encima de mil millones el formato de `es-MX` escribe
 * «1907.2 M», que obliga a contar dígitos; se dice «1.9 mil M».
 */
const numero = (n: number) =>
  n >= 1e9 ? `${(n / 1e9).toFixed(1)} mil M` : compacto.format(n);
const fecha = (iso: string | Date) =>
  new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric" }).format(
    typeof iso === "string" ? new Date(iso) : iso,
  );
const dinero = (n: number, moneda: string) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(n);

/* ---------------- Estilos ---------------- */

const s = StyleSheet.create({
  pagina: { fontFamily: FAMILIA, fontSize: 10, color: C.texto, backgroundColor: C.lienzo, padding: 36 },
  portada: { fontFamily: FAMILIA, backgroundColor: C.noche, color: C.papel, padding: 44 },

  cejaOscura: { fontSize: 8.5, fontWeight: 600, letterSpacing: 2, color: C.tenue, textTransform: "uppercase" },
  ceja: { fontSize: 8.5, fontWeight: 600, letterSpacing: 2, color: C.suave, textTransform: "uppercase" },

  avatar: { width: 112, height: 112, borderRadius: 56, objectFit: "cover" },
  avatarVacio: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: C.nocheSuave,
    borderWidth: 1,
    borderColor: C.lineaNoche,
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { fontSize: 40, fontWeight: 700, letterSpacing: -1.4, marginTop: 22, lineHeight: 1.05 },
  subtitulo: { fontSize: 12, color: C.tenue, marginTop: 14 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 14 },
  chipOscuro: {
    fontSize: 9,
    fontWeight: 500,
    color: C.papel,
    borderWidth: 1,
    borderColor: C.lineaNoche,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chipAcento: {
    fontSize: 9,
    fontWeight: 600,
    color: C.papel,
    backgroundColor: C.acento,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  chip: {
    fontSize: 9,
    fontWeight: 500,
    color: C.texto,
    backgroundColor: C.papel,
    borderWidth: 1,
    borderColor: C.linea,
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },

  cifrasOscuras: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: "auto" },
  cifraOscura: {
    width: "48.5%",
    backgroundColor: C.nocheSuave,
    borderWidth: 1,
    borderColor: C.lineaNoche,
    borderRadius: 16,
    padding: 16,
  },
  cifraValorOscuro: { fontSize: 30, fontWeight: 700, letterSpacing: -1, marginTop: 6 },
  cifraPie: { fontSize: 9, color: C.tenue, marginTop: 3 },

  pie: {
    position: "absolute",
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 8,
    color: C.tenue,
  },

  titulo: { fontSize: 22, fontWeight: 700, letterSpacing: -0.7, marginTop: 4, marginBottom: 14 },
  tarjeta: { backgroundColor: C.papel, borderWidth: 1, borderColor: C.linea, borderRadius: 16, overflow: "hidden" },
  fila: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: C.linea,
  },
  filaUltima: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 },
  celdaNombre: { flex: 1 },
  celdaNum: { width: 78, textAlign: "right" },
  cabeceraTabla: { fontSize: 8, color: C.suave, fontWeight: 600 },
  fuerte: { fontWeight: 600 },
  tenue: { color: C.suave, fontSize: 8.5, marginTop: 1 },

  seccion: { marginTop: 22 },

  rejilla: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  pieza: { width: "48.3%", backgroundColor: C.papel, borderWidth: 1, borderColor: C.linea, borderRadius: 14, overflow: "hidden" },
  miniatura: { width: "100%", height: 132, objectFit: "cover" },
  miniaturaVacia: { width: "100%", height: 132, backgroundColor: C.lienzo },
  piezaCuerpo: { padding: 12 },
  piezaTitulo: { fontSize: 10, fontWeight: 600, lineHeight: 1.3 },
  piezaDatos: { flexDirection: "row", gap: 12, marginTop: 8 },
  piezaDato: { fontSize: 8.5, color: C.suave },
  piezaVistas: { fontSize: 14, fontWeight: 700, letterSpacing: -0.4, color: C.acento },

  resumen: { flexDirection: "row", gap: 10, marginBottom: 16 },
  resumenCaja: { flex: 1, backgroundColor: C.papel, borderWidth: 1, borderColor: C.linea, borderRadius: 14, padding: 12 },
  resumenValor: { fontSize: 20, fontWeight: 700, letterSpacing: -0.6, marginTop: 4 },

  precio: { width: 110, textAlign: "right", fontSize: 13, fontWeight: 700, letterSpacing: -0.3 },
  nota: { fontSize: 8.5, color: C.suave, marginTop: 10, lineHeight: 1.4 },
});

/* ---------------- Documento ---------------- */

function Pie({ data }: { data: MediaKitData }) {
  return (
    <View style={s.pie} fixed>
      <Text>
        {data.creador.nombre} · Media kit · {fecha(data.generadoEl)}
      </Text>
      <Text render={({ pageNumber, totalPages }) => `Konnect · ${pageNumber}/${totalPages}`} />
    </View>
  );
}

function MediaKit({
  data,
  avatar,
  miniaturas,
}: {
  data: MediaKitData;
  avatar: Imagen;
  miniaturas: Imagen[];
}) {
  const { creador, cifras } = data;
  const inicial = creador.nombre.trim().charAt(0).toUpperCase() || "·";

  // En un documento para clientes un «0» o un guion restan: si todavía no hay
  // resultados medidos, esa casilla enseña otra cosa que sí dice algo.
  const terceraCifra =
    cifras.vistasParaMarcas > 0
      ? {
          ceja: "Vistas para marcas",
          valor: numero(cifras.vistasParaMarcas),
          pie: `en ${cifras.piezasPublicadas} pieza${cifras.piezasPublicadas === 1 ? "" : "s"} publicada${cifras.piezasPublicadas === 1 ? "" : "s"}`,
        }
      : {
          ceja: "Canales y redes",
          valor: String(data.canales.length + data.redes.length),
          pie: "donde publica",
        };
  const cuartaCifra =
    cifras.engagement !== null
      ? { ceja: "Engagement", valor: `${cifras.engagement.toFixed(1)}%`, pie: "likes y comentarios sobre vistas" }
      : data.marcas.length > 0
        ? {
            ceja: "Marcas",
            valor: String(data.marcas.length),
            pie: `con las que ha trabajado`,
          }
        : {
            ceja: cifras.etiquetaContenido,
            valor: numero(cifras.contenidos),
            pie: "publicados en su canal",
          };

  return (
    <Document title={`Media kit · ${creador.nombre}`} author="Konnect" creator="BlackBull Engine">
      {/* ---------------- Portada ---------------- */}
      <Page size="A4" style={s.portada}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.cejaOscura}>Media kit</Text>
          <Text style={s.cejaOscura}>{fecha(data.generadoEl)}</Text>
        </View>

        <View style={{ marginTop: 56 }}>
          {avatar ? (
            // eslint-disable-next-line jsx-a11y/alt-text
            <Image src={avatar} style={s.avatar} />
          ) : (
            <View style={s.avatarVacio}>
              <Text style={{ fontSize: 40, fontWeight: 700 }}>{inicial}</Text>
            </View>
          )}
          <Text style={s.nombre}>{creador.nombre}</Text>
          <Text style={s.subtitulo}>
            {[creador.handle, creador.plataforma, creador.pais].filter(Boolean).join("  ·  ")}
          </Text>
          <View style={s.chips}>
            {creador.categorias.map((c, i) => (
              <Text key={c} style={i === 0 ? s.chipAcento : s.chipOscuro}>
                {c}
              </Text>
            ))}
          </View>
        </View>

        <View style={s.cifrasOscuras}>
          <View style={s.cifraOscura}>
            <Text style={s.cejaOscura}>Audiencia total</Text>
            <Text style={s.cifraValorOscuro}>{numero(cifras.audienciaTotal)}</Text>
            <Text style={s.cifraPie}>sumando canales y redes</Text>
          </View>
          <View style={s.cifraOscura}>
            <Text style={s.cejaOscura}>{cifras.etiquetaVistas}</Text>
            <Text style={s.cifraValorOscuro}>{numero(cifras.vistasCanal)}</Text>
            <Text style={s.cifraPie}>
              {numero(cifras.contenidos)} {cifras.etiquetaContenido.toLowerCase()}
            </Text>
          </View>
          {[terceraCifra, cuartaCifra].map((c) => (
            <View key={c.ceja} style={s.cifraOscura}>
              <Text style={s.cejaOscura}>{c.ceja}</Text>
              <Text style={s.cifraValorOscuro}>{c.valor}</Text>
              <Text style={s.cifraPie}>{c.pie}</Text>
            </View>
          ))}
        </View>

        <Text style={{ fontSize: 8, color: C.tenue, marginTop: 18 }}>
          Konnect · generado con BlackBull Engine
        </Text>
      </Page>

      {/* ---------------- Dónde publica ---------------- */}
      <Page size="A4" style={s.pagina}>
        <Text style={s.ceja}>Dónde publica</Text>
        <Text style={s.titulo}>Canales y redes</Text>

        <View style={s.tarjeta}>
          <View style={s.fila}>
            <Text style={[s.celdaNombre, s.cabeceraTabla]}>Canal</Text>
            <Text style={[s.celdaNum, s.cabeceraTabla]}>{cifras.etiquetaAudiencia}</Text>
            <Text style={[s.celdaNum, s.cabeceraTabla]}>Vistas</Text>
            <Text style={[s.celdaNum, s.cabeceraTabla]}>Contenido</Text>
          </View>
          {data.canales.map((c, i) => (
            <View key={`${c.nombre}-${i}`} style={i === data.canales.length - 1 ? s.filaUltima : s.fila}>
              <View style={s.celdaNombre}>
                <Text style={s.fuerte}>{c.nombre}</Text>
                <Text style={s.tenue}>{c.detalle}</Text>
              </View>
              <Text style={[s.celdaNum, s.fuerte]}>{numero(c.audiencia)}</Text>
              <Text style={s.celdaNum}>{numero(c.vistas)}</Text>
              <Text style={s.celdaNum}>{numero(c.contenidos)}</Text>
            </View>
          ))}
        </View>

        {data.redes.length > 0 && (
          <View style={s.seccion}>
            <Text style={[s.ceja, { marginBottom: 8 }]}>Otras redes</Text>
            <View style={s.tarjeta}>
              {data.redes.map((r, i) => (
                <View key={`${r.red}-${r.handle}`} style={i === data.redes.length - 1 ? s.filaUltima : s.fila}>
                  <View style={s.celdaNombre}>
                    <Text style={s.fuerte}>{r.red}</Text>
                    <Text style={s.tenue}>{r.handle}</Text>
                  </View>
                  <Text style={[s.celdaNum, s.fuerte]}>
                    {r.seguidores > 0 ? numero(r.seguidores) : ""}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {data.marcas.length > 0 && (
          <View style={s.seccion}>
            <Text style={[s.ceja, { marginBottom: 8 }]}>Marcas con las que ha trabajado</Text>
            <View style={s.chips}>
              {data.marcas.map((m) => (
                <Text key={m} style={s.chip}>
                  {m}
                </Text>
              ))}
            </View>
          </View>
        )}

        <Pie data={data} />
      </Page>

      {/* ---------------- Portafolio ---------------- */}
      {data.destacadas.length > 0 && (
        <Page size="A4" style={s.pagina}>
          <Text style={s.ceja}>Portafolio</Text>
          <Text style={s.titulo}>Contenido destacado</Text>

          <View style={s.resumen}>
            <View style={s.resumenCaja}>
              <Text style={s.ceja}>Vistas para marcas</Text>
              <Text style={s.resumenValor}>{numero(cifras.vistasParaMarcas)}</Text>
            </View>
            <View style={s.resumenCaja}>
              <Text style={s.ceja}>Piezas publicadas</Text>
              <Text style={s.resumenValor}>{cifras.piezasPublicadas}</Text>
            </View>
            <View style={s.resumenCaja}>
              <Text style={s.ceja}>Engagement</Text>
              <Text style={s.resumenValor}>
                {cifras.engagement === null ? "—" : `${cifras.engagement.toFixed(1)}%`}
              </Text>
            </View>
          </View>

          <View style={s.rejilla}>
            {data.destacadas.map((p, i) => (
              <View key={`${p.titulo}-${i}`} style={s.pieza} wrap={false}>
                {miniaturas[i] ? (
                  // eslint-disable-next-line jsx-a11y/alt-text
                  <Image src={miniaturas[i]!} style={s.miniatura} />
                ) : (
                  <View style={s.miniaturaVacia} />
                )}
                <View style={s.piezaCuerpo}>
                  <Text style={s.piezaTitulo}>{p.titulo}</Text>
                  <Text style={s.tenue}>
                    {[p.marca, p.pieza, p.fecha ? fecha(p.fecha) : null].filter(Boolean).join(" · ")}
                  </Text>
                  <View style={s.piezaDatos}>
                    <Text style={s.piezaVistas}>{numero(p.vistas)} vistas</Text>
                    {p.likes !== null && <Text style={s.piezaDato}>{numero(p.likes)} likes</Text>}
                    {p.comentarios !== null && (
                      <Text style={s.piezaDato}>{numero(p.comentarios)} comentarios</Text>
                    )}
                  </View>
                </View>
              </View>
            ))}
          </View>

          <Pie data={data} />
        </Page>
      )}

      {/* ---------------- Tarifas ---------------- */}
      {data.conTarifas && (
        <Page size="A4" style={s.pagina}>
          <Text style={s.ceja}>Tarifas</Text>
          <Text style={s.titulo}>Precio por pieza</Text>

          {data.tarifas.length === 0 ? (
            <Text style={s.nota}>Tarifas a consultar con la agencia.</Text>
          ) : (
            <>
            <View style={s.tarjeta}>
              {data.tarifas.map((t, i) => (
                <View
                  key={`${t.red}-${t.pieza}-${t.canal}-${i}`}
                  style={i === data.tarifas.length - 1 ? s.filaUltima : s.fila}
                >
                  <View style={s.celdaNombre}>
                    <Text style={s.fuerte}>{t.pieza}</Text>
                    <Text style={s.tenue}>{[t.red, t.canal].filter(Boolean).join(" · ")}</Text>
                  </View>
                  <Text style={s.precio}>{dinero(t.precio, data.moneda)}</Text>
                </View>
              ))}
            </View>
            <Text style={s.nota}>
              Precios por pieza en {data.moneda}, vigentes a {fecha(data.generadoEl)}. Los
              paquetes de varias piezas y las exclusividades se cotizan aparte.
            </Text>
            </>
          )}

          <Pie data={data} />
        </Page>
      )}
    </Document>
  );
}

/** Genera el media kit de un creador y devuelve el PDF. */
export async function generarMediaKit(data: MediaKitData): Promise<Buffer> {
  const [avatar, ...miniaturas] = await Promise.all([
    traerImagen(data.creador.avatarUrl),
    ...data.destacadas.map((p) => traerImagen(p.miniaturaUrl)),
  ]);
  return renderToBuffer(<MediaKit data={data} avatar={avatar} miniaturas={miniaturas} />);
}

import type { ReactNode } from "react";
import { Document, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CURRENCIES } from "@/lib/labels";
import { FAMILIA } from "./estilo";

type Contrato = {
  tipo: "empresa" | "influencer";
  contraparte: string;
  valor: number;
  moneda: (typeof CURRENCIES)[number];
};

const s = StyleSheet.create({
  pagina: { paddingHorizontal: 62, paddingTop: 54, paddingBottom: 49, fontFamily: FAMILIA, fontSize: 10.7, color: "#181818" },
  titulo: { fontSize: 13.5, fontWeight: 700, textAlign: "center", marginBottom: 21, lineHeight: 1.35 },
  texto: { textAlign: "justify", lineHeight: 1.04, marginBottom: 10 },
  negrita: { fontWeight: 700 },
  inciso: { flexDirection: "row", marginBottom: 6, paddingLeft: 8 },
  letra: { width: 20, fontWeight: 700 },
  detalle: { flex: 1, textAlign: "justify", lineHeight: 1.04 },
  firmas: { flexDirection: "row", gap: 28, marginTop: 38 },
  firma: { flex: 1, borderTopWidth: 0.7, borderTopColor: "#555555", paddingTop: 6, fontSize: 9, lineHeight: 1.6 },
  pie: { position: "absolute", bottom: 28, left: 62, right: 62, fontSize: 8, textAlign: "right", color: "#656565" },
});

function Clausula({ titulo, children }: { titulo: string; children: ReactNode }) {
  return <Text style={s.texto}><Text style={s.negrita}>{titulo}. </Text>{children}</Text>;
}

function Incisos({ puntos }: { puntos: string[] }) {
  return puntos.map((punto, i) => (
    <View key={punto} style={s.inciso}>
      <Text style={s.letra}>{String.fromCharCode(97 + i)})</Text>
      <Text style={s.detalle}>{punto}</Text>
    </View>
  ));
}

function Hoja({ children }: { children: ReactNode }) {
  return (
    <Page size="A4" style={s.pagina}>
      {children}
      <Text fixed style={s.pie} render={({ pageNumber, totalPages }) => `Konnect   ·   Página ${pageNumber} de ${totalPages}`} />
    </Page>
  );
}

const obligacionesAgencia = [
  "Preparar una propuesta de contenidos a partir de los objetivos y del público definidos por la empresa. Presentar los perfiles de creadores y los formatos previstos para que la empresa confirme su selección.",
  "Transmitir a los creadores las instrucciones aprobadas, coordinar las entregas y remitir a la empresa las piezas que requieran revisión antes de publicarse.",
  "Informar a la empresa de cualquier incidencia que afecte una entrega y proponer un ajuste al calendario. Al cierre, reunir los enlaces y las evidencias de ejecución disponibles.",
];

const obligacionesInfluencer = [
  "Preparar las piezas en el formato acordado, respetar el mensaje aprobado y conservar el sentido de su propia experiencia al describir un producto o servicio.",
  "Entregar a Konnect la versión prevista para revisión. Antes de publicar, comprobar que los enlaces, menciones, subtítulos y demás elementos acordados correspondan a la versión aprobada.",
  "Comunicar cualquier circunstancia que impida cumplir una fecha y proponer una alternativa. Tras la publicación, facilitar el enlace y las métricas disponibles para las piezas contratadas.",
];

export function generarContrato({ tipo, contraparte, valor, moneda }: Contrato) {
  const empresa = tipo === "empresa";
  const rol = empresa ? "LA EMPRESA" : "EL INFLUENCER";
  const titulo = empresa
    ? "CONTRATO DE PRESTACIÓN DE SERVICIOS DE GESTIÓN DE CAMPAÑA"
    : "CONTRATO DE PRESTACIÓN DE SERVICIOS DE CREACIÓN DE CONTENIDO";
  const importe = new Intl.NumberFormat("es-MX", {
    style: "currency", currency: moneda, currencyDisplay: "code",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(valor);
  const fecha = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" }).format(new Date());
  // Permite partir identificadores comerciales muy largos sin alterar el nombre almacenado.
  const nombre = contraparte.replace(/\S{40,}/gu, (palabra) => palabra.match(/.{1,35}/gu)!.join("\n"));

  return renderToBuffer(
    <Document title={titulo} author="Konnect" language="es">
      <Hoja>
        <Text style={s.titulo}>{titulo}</Text>
        <Text style={s.texto}>
          Entre <Text style={s.negrita}>Konnect</Text>, en adelante <Text style={s.negrita}>LA AGENCIA</Text>, y <Text style={s.negrita}>{nombre}</Text>, en adelante <Text style={s.negrita}>{rol}</Text>, se celebra el presente contrato. Las partes dejan constancia del objeto de su colaboración, del valor convenido y de las condiciones de ejecución que se desarrollan a continuación.
        </Text>
        <Clausula titulo="PRIMERA. OBJETO">
          {empresa
            ? "LA EMPRESA encarga a LA AGENCIA la coordinación de una campaña de comunicación con creadores de contenido. El servicio comprende preparar la propuesta, coordinar la producción y hacer seguimiento a las publicaciones que las partes aprueben."
            : "LA AGENCIA encarga al INFLUENCER la creación de contenido para una campaña de comunicación. EL INFLUENCER producirá las piezas acordadas y, cuando el encargo comprenda su difusión, las publicará en los perfiles que ambas partes identifiquen."}
        </Clausula>
        <Clausula titulo="SEGUNDA. ALCANCE DEL ENCARGO">
          Antes de comenzar la producción, las partes confirmarán por escrito la marca, el mensaje, los canales, el número de piezas, los formatos y la persona responsable de aprobarlos. Esa confirmación servirá como referencia para revisar las entregas. Cualquier ampliación del encargo requerirá acuerdo sobre su alcance, precio y calendario.
        </Clausula>
        <Clausula titulo="TERCERA. CALENDARIO DE EJECUCIÓN">
          Las partes acordarán las fechas de entrega de materiales, revisión y publicación. Si se retrasa un insumo necesario, quien detecte la incidencia avisará a su contraparte e identificará las piezas afectadas. Ambas partes dejarán por escrito las nuevas fechas antes de reanudar el trabajo afectado.
        </Clausula>
        <Clausula titulo={empresa ? "CUARTA. OBLIGACIONES DE LA AGENCIA" : "CUARTA. OBLIGACIONES DEL INFLUENCER"}>
          Para ejecutar el encargo, {empresa ? "LA AGENCIA" : "EL INFLUENCER"} asume las siguientes obligaciones.
        </Clausula>
        <Incisos puntos={empresa ? obligacionesAgencia : obligacionesInfluencer} />
      </Hoja>
      <Hoja>
        <Text style={s.titulo}>EJECUCIÓN Y CONDICIONES ECONÓMICAS</Text>
        <Clausula titulo={empresa ? "QUINTA. OBLIGACIONES DE LA EMPRESA" : "QUINTA. OBLIGACIONES DE LA AGENCIA"}>
          {empresa ? "LA EMPRESA facilitará la información necesaria para representar correctamente su oferta. En particular, se obliga a lo siguiente." : "LA AGENCIA coordinará el encargo y facilitará al INFLUENCER las condiciones de la colaboración. En particular, se obliga a lo siguiente."}
        </Clausula>
        <Incisos puntos={empresa ? [
          "Entregar las instrucciones de marca, las referencias y los materiales autorizados. Indicar las condiciones de las ofertas y respaldar las afirmaciones sobre sus productos o servicios.",
          "Designar a una persona de contacto que consolide las observaciones de la empresa y comunique su aprobación para cada pieza.",
        ] : [
          "Entregar las instrucciones de campaña, los materiales autorizados y las condiciones de las ofertas que deban mencionarse en el contenido.",
          "Consolidar los comentarios de la marca y comunicar al INFLUENCER las correcciones solicitadas y la aprobación de la versión que podrá publicarse.",
        ]} />
        <Clausula titulo="SEXTA. VALOR Y PAGO">
          {empresa ? "LA EMPRESA pagará a LA AGENCIA" : "LA AGENCIA pagará al INFLUENCER"} la suma total de <Text style={s.negrita}>{importe}</Text> por los servicios descritos. Las partes confirmarán por escrito el vencimiento, el medio de pago y, si se pactan cuotas, el importe y la fecha de cada una. Todo gasto adicional que una parte pretenda cobrar a la otra requerirá autorización previa por escrito.
        </Clausula>
        <Clausula titulo="SÉPTIMA. ENTREGA Y REVISIÓN">
          Cada entrega identificará la pieza y su versión. Las observaciones deberán indicar qué elemento se aparta de las instrucciones aprobadas y qué ajuste se solicita. Cuando una petición cambie el formato, el mensaje o la cantidad de piezas, las partes acordarán el efecto de ese cambio antes de ejecutarlo.
        </Clausula>
        <Clausula titulo="OCTAVA. IDENTIFICACIÓN DE LA PUBLICIDAD">
          Las partes acordarán una indicación visible y comprensible del carácter publicitario de cada publicación. Quien prepare el contenido conservará esa indicación en la versión final y comunicará cualquier error que pueda inducir a confusión sobre la oferta o sobre la relación con la marca.
        </Clausula>
        <Clausula titulo="NOVENA. SEGUIMIENTO">
          Las partes revisarán la ejecución con base en las piezas entregadas y los canales convenidos. Cuando el encargo incluya métricas, el informe indicará la plataforma, la fecha de consulta y el período medido, de modo que ambas partes puedan interpretar los resultados sobre la misma base.
        </Clausula>
      </Hoja>
      <Hoja>
        <Text style={s.titulo}>USO DE MATERIALES, CIERRE Y FIRMAS</Text>
        <Clausula titulo="DÉCIMA. USO DE LOS CONTENIDOS">
          Cada parte conservará los derechos sobre sus materiales previos. La autorización de uso de las piezas finales identificará los canales, el plazo y las modalidades de difusión convenidos. La pauta pagada, la edición posterior y la reutilización en otra campaña requerirán autorización específica de quien tenga los derechos correspondientes.
        </Clausula>
        <Clausula titulo="UNDÉCIMA. RESERVA DE LA INFORMACIÓN">
          Las partes utilizarán los presupuestos, borradores, accesos y planes de lanzamiento recibidos para ejecutar el encargo. Limitarán su circulación a las personas que los necesiten para trabajar en la campaña. Si se comparte un archivo por error, quien lo advierta avisará a la otra parte para que ambas puedan contener la divulgación.
        </Clausula>
        <Clausula titulo="DUODÉCIMA. CAMBIOS Y CIERRE ANTICIPADO">
          Si una parte necesita suspender o cancelar la colaboración, comunicará el motivo y la fecha propuesta por escrito. Las partes identificarán las entregas realizadas, los gastos previamente autorizados y los pagos pendientes. Dejarán constancia del saldo acordado y del destino de las piezas pendientes de publicación.
        </Clausula>
        <Clausula titulo="DECIMOTERCERA. COMUNICACIONES Y DIFERENCIAS">
          Las aprobaciones y los cambios se comunicarán por el canal escrito que las partes designen. Si surge una diferencia, sus representantes revisarán el encargo aprobado, las entregas y los comprobantes, y dejarán por escrito los acuerdos que alcancen.
        </Clausula>
        <Clausula titulo="DECIMOCUARTA. ACEPTACIÓN">
          Cada parte expresará su conformidad mediante la firma de quien actúe en su nombre. El presente documento se emite el {fecha}. La fecha de suscripción se consignará junto a cada firma.
        </Clausula>
        <View style={s.firmas}>
          {["POR KONNECT", empresa ? "POR LA EMPRESA" : "EL INFLUENCER"].map((parte) => (
            <View style={s.firma} key={parte}>
              <Text style={s.negrita}>{parte}</Text>
              <Text>Nombre: __________________________</Text>
              <Text>Identificación: _____________________</Text>
              <Text>Fecha: ____________________________</Text>
            </View>
          ))}
        </View>
      </Hoja>
    </Document>,
  );
}

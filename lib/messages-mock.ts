/**
 * Datos de la maqueta de Mensajes. Cuando se conecte el correo de GoDaddy
 * (IMAP/SMTP sobre secureserver.net, o su API de Microsoft 365) esto se
 * reemplaza por la bandeja real: la vista no cambia.
 */

export type MessageLabel = "campaña" | "negociación" | "factura" | "brief" | "contrato";

export type Message = {
  id: string;
  from: string;
  fromEmail: string;
  outgoing: boolean;
  sentAt: string;
  body: string[];
};

export type Thread = {
  id: string;
  subject: string;
  counterpart: string;
  counterpartEmail: string;
  /** A qué ficha de la agencia pertenece el hilo. */
  relatedTo: { kind: "creador" | "empresa"; name: string; href: string } | null;
  labels: MessageLabel[];
  unread: boolean;
  starred: boolean;
  folder: "recibidos" | "enviados" | "archivados";
  lastActivity: string;
  messages: Message[];
};

export const MAILBOX = "hola@konnect.agency";

export const THREADS: Thread[] = [
  {
    id: "th_01",
    subject: "Nova Labs — cierre de guion para Suite 3.0",
    counterpart: "Marta Quiroga",
    counterpartEmail: "marta@novalabs.io",
    relatedTo: { kind: "empresa", name: "Nova Labs", href: "/empresas/co_01" },
    labels: ["campaña", "brief"],
    unread: true,
    starred: true,
    folder: "recibidos",
    lastActivity: "2026-08-20T14:05:00.000Z",
    messages: [
      {
        id: "ms_01",
        from: "Marta Quiroga",
        fromEmail: "marta@novalabs.io",
        outgoing: false,
        sentAt: "2026-08-19T16:40:00.000Z",
        body: [
          "Hola equipo,",
          "Revisamos el guion que mandó Valentina y nos gusta el enfoque. Solo pedimos dos ajustes: mencionar el plan Team en el minuto 2 y no comparar directamente con la competencia.",
          "¿Alcanzamos a grabar esta semana?",
        ],
      },
      {
        id: "ms_02",
        from: "Konnect",
        fromEmail: MAILBOX,
        outgoing: true,
        sentAt: "2026-08-19T18:12:00.000Z",
        body: [
          "Marta, buenas tardes.",
          "Ambos ajustes entran sin problema. Valentina graba el jueves y el corte para revisión lo tienen el lunes.",
          "Les confirmo en cuanto tengamos el archivo.",
        ],
      },
      {
        id: "ms_03",
        from: "Marta Quiroga",
        fromEmail: "marta@novalabs.io",
        outgoing: false,
        sentAt: "2026-08-20T14:05:00.000Z",
        body: [
          "Perfecto. Una última cosa: necesitamos el reporte de métricas a los 14 días de publicado, no a los 30.",
        ],
      },
    ],
  },
  {
    id: "th_02",
    subject: "Tarifa para integración — Terra Bebidas",
    counterpart: "Andrés Melo",
    counterpartEmail: "contacto@melogaming.co",
    relatedTo: { kind: "creador", name: "Andrés Melo", href: "/creadores/cr_02" },
    labels: ["negociación"],
    unread: true,
    starred: false,
    folder: "recibidos",
    lastActivity: "2026-08-20T11:20:00.000Z",
    messages: [
      {
        id: "ms_04",
        from: "Andrés Melo",
        fromEmail: "contacto@melogaming.co",
        outgoing: false,
        sentAt: "2026-08-20T11:20:00.000Z",
        body: [
          "Qué más, equipo.",
          "Por la integración de 90 segundos manejo 2.600 USD, pero si son dos videos en el mismo mes lo dejo en 2.400 cada uno.",
          "Avísenme y bloqueo la agenda de septiembre.",
        ],
      },
    ],
  },
  {
    id: "th_03",
    subject: "Factura F-2026-117 vencida",
    counterpart: "Julián Arce",
    counterpartEmail: "julian.arce@terrabebidas.com",
    relatedTo: { kind: "empresa", name: "Terra Bebidas", href: "/empresas/co_02" },
    labels: ["factura"],
    unread: false,
    starred: false,
    folder: "recibidos",
    lastActivity: "2026-08-18T09:30:00.000Z",
    messages: [
      {
        id: "ms_05",
        from: "Konnect",
        fromEmail: MAILBOX,
        outgoing: true,
        sentAt: "2026-08-16T10:00:00.000Z",
        body: [
          "Julián, buen día.",
          "Te recuerdo la factura F-2026-117 por 9.500 USD, con vencimiento el 15 de agosto. Adjunto el documento otra vez por si se traspapeló.",
        ],
      },
      {
        id: "ms_06",
        from: "Julián Arce",
        fromEmail: "julian.arce@terrabebidas.com",
        outgoing: false,
        sentAt: "2026-08-18T09:30:00.000Z",
        body: [
          "Recibido. Ya quedó en la corrida de pagos del viernes, disculpa la demora.",
        ],
      },
    ],
  },
  {
    id: "th_04",
    subject: "Contrato de exclusividad — Sofía Lem",
    counterpart: "Sofía Lem",
    counterpartEmail: "sofia.lem@gmail.com",
    relatedTo: { kind: "creador", name: "Sofía Lem", href: "/creadores/cr_05" },
    labels: ["contrato", "negociación"],
    unread: false,
    starred: true,
    folder: "recibidos",
    lastActivity: "2026-08-15T17:45:00.000Z",
    messages: [
      {
        id: "ms_07",
        from: "Sofía Lem",
        fromEmail: "sofia.lem@gmail.com",
        outgoing: false,
        sentAt: "2026-08-15T17:45:00.000Z",
        body: [
          "Buenas tardes,",
          "Revisé la cláusula de exclusividad. Acepto 60 días por categoría, pero no puedo firmar exclusividad total de belleza porque ya tengo un acuerdo anual con otra marca de perfumería.",
          "Si eso les sirve, seguimos.",
        ],
      },
    ],
  },
  {
    id: "th_05",
    subject: "Brief de otoño — Hábito Skincare",
    counterpart: "Renata Villa",
    counterpartEmail: "renata@habitoskin.mx",
    relatedTo: { kind: "empresa", name: "Hábito Skincare", href: "/empresas/co_04" },
    labels: ["brief"],
    unread: false,
    starred: false,
    folder: "enviados",
    lastActivity: "2026-08-12T12:10:00.000Z",
    messages: [
      {
        id: "ms_08",
        from: "Konnect",
        fromEmail: MAILBOX,
        outgoing: true,
        sentAt: "2026-08-12T12:10:00.000Z",
        body: [
          "Renata, buenos días.",
          "Te mando la propuesta para la rutina de otoño: dos creadoras de lifestyle, un video dedicado y dos shorts, presupuesto de 4.200 USD.",
          "Quedo atenta a tus comentarios.",
        ],
      },
    ],
  },
  {
    id: "th_06",
    subject: "Reporte quincenal — Kairo Fintech",
    counterpart: "Diego Sotelo",
    counterpartEmail: "diego@kairo.finance",
    relatedTo: { kind: "empresa", name: "Kairo Fintech", href: "/empresas/co_03" },
    labels: ["campaña"],
    unread: false,
    starred: false,
    folder: "archivados",
    lastActivity: "2026-06-02T08:00:00.000Z",
    messages: [
      {
        id: "ms_09",
        from: "Konnect",
        fromEmail: MAILBOX,
        outgoing: true,
        sentAt: "2026-06-02T08:00:00.000Z",
        body: [
          "Diego,",
          "Cierre de la campaña de educación financiera: 1,93 M de vistas contra una meta de 1,63 M, 118% de cumplimiento.",
          "Adjunto el desglose por pieza.",
        ],
      },
    ],
  },
];

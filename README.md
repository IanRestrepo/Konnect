# Konnect — gestión interna de agencia de creadores

App interna para administrar creadores, campañas, empresas cliente y finanzas.

**Stack:** Next.js 16 (App Router) · React 19 · TailwindCSS 4 · Prisma 7 + Neon · Lucide.

---

## Arrancar

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Sin variables de entorno la app funciona con **datos demo**
(`lib/mock-data.ts`) para que puedas ver y validar toda la interfaz.

## Variables de entorno

Copia `.env.example` a `.env.local`:

| Variable | Para qué sirve |
| --- | --- |
| `DATABASE_URL` | Conexión a Neon. Mientras esté vacía se usan los datos demo. |
| `YOUTUBE_API_KEY` | YouTube Data API v3. Sin ella, los buscadores de canal y video responden en modo demo. |
| `SENSITIVE_ACCESS_CODE` | Código que pide la app antes de revelar datos bancarios. |
| `ENCRYPTION_KEY` | 32 bytes en base64 para cifrar los datos bancarios en reposo. |

Generar la clave de cifrado:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### API Key de YouTube

1. Entra a Google Cloud Console → crea un proyecto.
2. **APIs y servicios → Biblioteca** → activa *YouTube Data API v3*.
3. **Credenciales → Crear credenciales → Clave de API**.
4. Restringe la clave a *YouTube Data API v3*.

Cuota gratuita: 10.000 unidades/día. Consultar un canal por handle o un video cuesta
1 unidad; resolver una URL personalizada (`/c/nombre`) cuesta 100 porque requiere búsqueda.

## Base de datos

El esquema vive en `prisma/schema.prisma` y la URL se configura en `prisma.config.ts`
(Prisma 7 ya no la lee desde el schema).

```bash
npx prisma migrate dev --name init
npx prisma studio
```

Para pasar de datos demo a Neon basta reemplazar el cuerpo de las funciones de
`lib/data.ts` por consultas Prisma: las páginas no cambian.

---

## Módulos

### Creadores (`/creadores`)
Alta pegando el enlace del canal de YouTube: se autocompletan nombre, foto, suscriptores,
vistas totales y número de videos. A mano se capturan categoría, contacto (correo y
teléfono), métodos de pago y las tres tarifas mínimas acordadas: **video dedicado**,
**reel/short** y **fracción publicitaria dentro de un video**.

### Campañas (`/campanas`)
Vista tipo administrador de anuncios: tabla densa con selección múltiple, filtros por
estado, fila de totales y métricas derivadas (CPM efectivo, tasa de interacción, avance de
presupuesto). Cada entregable se añade pegando el enlace del video y trae sus métricas
públicas.

### Empresas (`/empresas`)
Clientes que contratan: contacto, sitio web, redes, campañas asociadas e inversión
acumulada.

### Finanzas (`/finanzas`)
**Solo maqueta visual**, sin lógica conectada: facturación, cobros, pagos a creadores y
margen.

### Configuración (`/configuracion`)
Apariencia (modo claro/oscuro/sistema, 10 acentos, 3 estilos de navegación, densidad),
seguridad del código de acceso, integraciones y datos de la agencia. El mismo panel está
en el menú **Opciones** de la barra lateral.

---

## Datos sensibles

La información bancaria nunca se muestra por defecto:

- se guarda cifrada con **AES-256-GCM** (`lib/crypto.ts`), con los últimos dígitos en claro
  solo para la vista censurada;
- revelarla exige el código de acceso vía `POST /api/creadores/[id]/revelar`;
- 5 intentos fallidos bloquean 10 minutos, y la sesión desbloqueada expira sola a los 5;
- cada revelación se registra (modelo `SensitiveAccessLog`).

## Qué da y qué no da la API pública de YouTube

**Sí** (sin ser dueño del canal): nombre, foto, suscriptores, vistas totales, nº de videos;
y por video: título, miniatura, fecha, duración, vistas, likes y comentarios.

**No**: retención, tiempo de visualización, demografía, CTR e ingresos. Eso solo existe en
la YouTube Analytics API, que requiere que el creador autorice su cuenta por OAuth.

TikTok e Instagram no exponen métricas públicas equivalentes: esas cifras se capturan a
mano.

## Notas

- `npm audit` reporta un aviso en `deepmerge-ts`, dependencia del **CLI** de Prisma (no del
  runtime). El arreglo automático degrada Prisma a la 6, así que se dejó como está.

import "./portal.css";

/**
 * El portal no comparte superficie con la aplicación: ni barra lateral, ni
 * tema configurable, ni acentos. Su hoja de estilos se carga solo aquí para
 * que las dos interfaces puedan evolucionar por separado.
 */
export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <div className="portal">{children}</div>;
}

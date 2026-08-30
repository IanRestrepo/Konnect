import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences-provider";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/lib/session";
import { activeAnnouncementsFor, getDisabledModules } from "@/lib/store";
import { THEME_SCRIPT } from "@/lib/theme";
import { InlineScript } from "@/components/inline-script";
import { Splash } from "@/components/shell/splash";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  // 700 se carga por la negrita del editor: con 600 (SemiBold) el texto en
  // negrita apenas se distingue del normal a tamaño de lectura.
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Konnect",
  description: "Operación interna de la agencia: creadores, campañas, empresas y finanzas.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const [announcements, disabledModules] = session
    ? await Promise.all([activeAnnouncementsFor(session.roleId), getDisabledModules()])
    : [[], []];

  /*
   * El tema no se declara como prop de <html> a propósito.
   *
   * Si React controla `data-theme`, lo reconcilia en cada re-render del
   * layout y lo devuelve al valor del servidor —siempre claro—, pisando la
   * preferencia del usuario. Con `router.refresh()` en casi cada guardado,
   * el tema se caía solo cada dos por tres.
   *
   * Los tres atributos los pone THEME_SCRIPT antes del primer pintado y los
   * mantiene `applyToDocument`. React no los toca.
   */
  return (
    <html
      lang="es"
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <InlineScript html={THEME_SCRIPT} />
      </head>
      <body className="min-h-full">
        <Splash />
        <PreferencesProvider>
          <SessionProvider session={session} disabledModules={disabledModules}>
            <AppShell announcements={announcements}>{children}</AppShell>
          </SessionProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}

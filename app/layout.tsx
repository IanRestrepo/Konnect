import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";
import { PreferencesProvider } from "@/components/preferences-provider";
import { SessionProvider } from "@/components/session-provider";
import { AppShell } from "@/components/shell/app-shell";
import { getSession } from "@/lib/session";
import { activeAnnouncementsFor, getDisabledModules } from "@/lib/store";
import { DEFAULT_PREFERENCES, THEME_SCRIPT } from "@/lib/theme";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
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

  return (
    <html
      lang="es"
      data-theme={DEFAULT_PREFERENCES.mode}
      data-accent={DEFAULT_PREFERENCES.accent}
      data-density={DEFAULT_PREFERENCES.density}
      className={`${poppins.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full">
        <PreferencesProvider>
          <SessionProvider session={session} disabledModules={disabledModules}>
            <AppShell announcements={announcements}>{children}</AppShell>
          </SessionProvider>
        </PreferencesProvider>
      </body>
    </html>
  );
}

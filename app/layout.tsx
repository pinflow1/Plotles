import type { Metadata, Viewport } from "next";
import { Fraunces, Source_Serif_4 } from "next/font/google";
import { ThemeProvider } from "@/lib/theme-context";
import { EditorPreferencesProvider } from "@/lib/editor-preferences";
import { SessionCacheProvider } from "@/lib/session-cache";
import { IdeaCapture } from "@/components/ideas/IdeaCapture";
import { RegisterServiceWorker } from "@/components/pwa/RegisterServiceWorker";
import "./globals.css";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  weight: ["400", "500"],
  display: "swap",
});

const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  weight: ["400", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Plotless",
  description: "A quiet place to write.",
  applicationName: "Plotless",
  icons: {
    icon: [
      { url: "/icons/icon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // The phone's status bar follows the phone's light/dark setting.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#D8D2C4" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

// Runs before hydration so the correct theme class is present on first
// paint — otherwise a saved "dark" preference would flash light for a
// frame. Kept tiny and dependency-free on purpose.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var saved = localStorage.getItem('plotless-theme');
    var mode = saved || 'system';
    var dark = mode === 'dark' || (mode === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
  } catch (e) {}
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="overscroll-none font-sans" suppressHydrationWarning>
        <ThemeProvider>
          <SessionCacheProvider>
            <EditorPreferencesProvider>
              {children}
              <IdeaCapture />
              <RegisterServiceWorker />
            </EditorPreferencesProvider>
          </SessionCacheProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

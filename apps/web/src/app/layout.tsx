import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEDIAH | Aprende anatomía",
  description:
    "Plataforma educativa de anatomía para conectar estudio teórico, práctica presencial y seguimiento del aprendizaje.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#4d1117",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}

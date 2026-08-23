import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEDIAH | Aprende por asignaturas",
  description:
    "Plataforma educativa para organizar videos, guías y recursos por asignatura.",
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

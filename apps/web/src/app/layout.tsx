import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CEDIAH | Anatomía semivirtual",
  description:
    "Plataforma educativa de anatomía para conectar estudio teórico, práctica presencial y seguimiento del aprendizaje.",
};

export const viewport: Viewport = {
  colorScheme: "dark light",
  themeColor: "#152235",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

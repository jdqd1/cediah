import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { PlatformFrame } from "@/components/platform-frame";
import { RouteLoadingScreen } from "@/components/route-loading-screen";
import "./globals.css";
import "./koraz-theme.css";
import "./platform-chrome.css";
import "./landing-paper.css";
import "./auth-paper.css";

export const metadata: Metadata = {
  title: "Koraz | Aprende, explora y crece",
  description:
    "Plataforma educativa para aprender con videos, guías y recursos organizados por materia.",
  icons: {
    icon: "/brand/koraz-mark.png",
    apple: "/brand/koraz-mark.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#4361EE",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth">
      <body><Suspense fallback={<RouteLoadingScreen />}><PlatformFrame>{children}</PlatformFrame></Suspense></body>
    </html>
  );
}

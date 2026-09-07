import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { PlatformFrame } from "@/components/platform-frame";
import { RouteLoadingScreen } from "@/components/route-loading-screen";
import "./globals.css";
import "./koras-theme.css";
import "./platform-chrome.css";
import "./landing-paper.css";
import "./auth-paper.css";
import "./learning.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-plus-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KORAS | Conocimiento que se convierte en vocación",
  description:
    "Plataforma educativa para aprender con videos, guías y recursos organizados por materia.",
  icons: {
    icon: "/brand/koras-mark.png",
    apple: "/brand/koras-mark.png",
  },
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#0F3D32",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-scroll-behavior="smooth" className={plusJakartaSans.variable}>
      <body><Suspense fallback={<RouteLoadingScreen />}><PlatformFrame>{children}</PlatformFrame></Suspense></body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { PlatformFrame } from "@/components/platform-frame";
import { RouteLoadingScreen } from "@/components/route-loading-screen";
import "./globals.css";
import "./koras-theme.css";
import "./platform-chrome.css";
import "./landing-paper.css";
import "./auth-paper.css";
import "./learning.css";

const plusJakartaSans = localFont({
  src: [
    { path: "../../public/fonts/PlusJakartaSans-Light.ttf", weight: "300", style: "normal" },
    { path: "../../public/fonts/PlusJakartaSans-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/PlusJakartaSans-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../public/fonts/PlusJakartaSans-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../../public/fonts/PlusJakartaSans-Bold.ttf", weight: "700", style: "normal" },
  ],
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

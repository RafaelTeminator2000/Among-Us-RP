import type { Metadata, Viewport } from "next";
import { Anton, Arimo, Barlow, Space_Mono } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const arimo = Arimo({
  subsets: ["latin"],
  variable: "--font-arimo",
  display: "swap",
});

const barlow = Barlow({
  weight: ["400", "600", "700", "900"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Among Us RP • Sistema Presencial",
  description: "Plataforma de automação e interface phygital para partidas presenciais de Among Us RP.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Among Us RP",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#030712",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      className={`${anton.variable} ${arimo.variable} ${barlow.variable} ${spaceMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col bg-[#030712] text-slate-100 font-sans select-none overflow-x-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}

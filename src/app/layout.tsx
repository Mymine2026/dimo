import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conexo Fleet Intelligence",
  description: "Monitor your DIMO-connected vehicles",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body
        className="antialiased min-h-screen"
        style={{ background: "#121317", color: "#ffffff" }}
      >
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}

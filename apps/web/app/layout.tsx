import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "../styles/modernist.css";
import "../styles/app.css";

// Self-hosted and preloaded, so the type doesn't reflow on first paint the way
// a stylesheet @import does. The design system's tokens read this variable.
const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Trailhead",
  description: "Connect Gmail and see everywhere you've ever travelled.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={archivo.variable}>
      <body>{children}</body>
    </html>
  );
}

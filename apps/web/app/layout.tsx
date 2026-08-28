import type { Metadata } from "next";
import "../styles/modernist.css";

export const metadata: Metadata = {
  title: "Trailhead",
  description: "Connect Gmail and see everywhere you've ever travelled.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
// Self-hosted fonts (no runtime call to Google; works on flaky networks)
import "@fontsource-variable/google-sans/wght.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dawai Dost",
  description: "Compare medicine composition and prices. Find composition-matched generic options.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

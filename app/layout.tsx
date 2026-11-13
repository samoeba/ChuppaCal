import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import TouchKeyboardProvider from "@/components/keyboard/touch-keyboard-provider";

const nationalPark = localFont({
  src: "../node_modules/@fontsource-variable/national-park/files/national-park-latin-wght-normal.woff2",
  variable: "--font-national-park",
  weight: "200 800",
  display: "swap",
  adjustFontFallback: false,
});

const geistMono = localFont({
  src: "../node_modules/@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ChuppaCal",
  description: "DIY family calendar — your kitchen command center",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${nationalPark.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-cc-beige text-cc-ink">
        <TouchKeyboardProvider>{children}</TouchKeyboardProvider>
      </body>
    </html>
  );
}

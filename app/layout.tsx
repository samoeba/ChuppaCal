import type { Metadata } from "next";
import { National_Park, Geist_Mono } from "next/font/google";
import "./globals.css";
import TouchKeyboardProvider from "@/components/keyboard/touch-keyboard-provider";

const nationalPark = National_Park({
  variable: "--font-national-park",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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

import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ConfigProvider } from "@/components/ConfigContext";
import { PresentationProvider } from "@/components/PresentationContext";
import { Assistant } from "@/components/Assistant";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Surface",
  description: "A Figma-style canvas for pull requests",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${mono.variable} h-full dark`}
      suppressHydrationWarning
    >
      <body
        className="h-full bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        <ThemeProvider>
          <ConfigProvider>
            <PresentationProvider>
              <Assistant>{children}</Assistant>
            </PresentationProvider>
          </ConfigProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

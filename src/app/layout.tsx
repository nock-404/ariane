import type { Metadata } from "next";
import { Mulish } from "next/font/google";
import { ThemeProvider } from "next-themes";

import { SkinBoot } from "@/components/skin-script";
import { SkinProvider } from "@/components/skin-provider";
import { ConfirmProvider } from "@/components/ui/confirm";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";

import "./globals.css";

const mulish = Mulish({
  variable: "--font-mulish",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ariane",
  description: "Kapazitätsplanung fürs Team.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" suppressHydrationWarning className={`${mulish.variable} h-full`}>
      <head>
        <SkinBoot />
      </head>
      <body className="flex min-h-full flex-col antialiased">
        <SkinProvider />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <TooltipProvider delay={250}>
            <ConfirmProvider>{children}</ConfirmProvider>
          </TooltipProvider>
          <Toaster position="bottom-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}

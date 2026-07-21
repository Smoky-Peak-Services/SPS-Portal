import type { Metadata, Viewport } from "next";
import "./globals.css";
import { company } from "@/config/company";
import { PwaRegister } from "@/components/pwa-register";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: company.shortName,
    template: `%s · ${company.shortName}`,
  },
  description: `${company.name} operations portal`,
  applicationName: company.shortName,
  appleWebApp: {
    capable: true,
    title: company.shortName,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [{ url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#0B1220",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("dark font-sans", geist.variable)}>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <TooltipProvider delay={200}>{children}</TooltipProvider>
        <PwaRegister />
      </body>
    </html>
  );
}

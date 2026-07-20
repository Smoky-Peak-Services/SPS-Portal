import type { Metadata, Viewport } from "next";
import "./globals.css";
import { company } from "@/config/company";
import { PwaRegister } from "@/components/pwa-register";

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
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: company.brand.primary,
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
    <html lang="en">
      <body className="min-h-screen antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

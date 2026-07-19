import type { Metadata } from "next";
import "./globals.css";
import { company } from "@/config/company";

export const metadata: Metadata = {
  title: {
    default: company.shortName,
    template: `%s · ${company.shortName}`,
  },
  description: `${company.name} operations portal`,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

import type { MetadataRoute } from "next";
import { company } from "@/config/company";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${company.name} Portal`,
    short_name: company.shortName,
    description: `Internal operations hub for ${company.name}.`,
    start_url: "/",
    display: "standalone",
    background_color: "#0B1220",
    theme_color: company.brand.primary,
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/brand/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

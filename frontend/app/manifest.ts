import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "MobiFlow",
    short_name: "MobiFlow",
    description: "Mobile shop: stock, sales, purchases and accounts",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait", // ✅ mobile app feel ke liye
    background_color: "#0b1220",
    theme_color: "#0b1220",
    lang: "en", // ✅ accessibility + install prompt
    dir: "ltr",
    categories: ["business", "productivity"], // ✅ Play Store-style hints
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "New sale", short_name: "Sale", url: "/sales/new" },
      { name: "New purchase", short_name: "Purchase", url: "/purchases/new" },
    ],
  };
}

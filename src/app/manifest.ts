import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "XLayer Estate",
    short_name: "XLayer Estate",
    description: "AI-underwritten physical assets with fractional X Layer markets.",
    start_url: "/",
    display: "standalone",
    background_color: "#05070d",
    theme_color: "#071522",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" }],
  };
}

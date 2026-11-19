import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "منصة لغتي",
    short_name: "لغتي",
    description: "ألعاب وواجبات لغتي للصف الرابع",
    start_url: "/student",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f8f7fc",
    theme_color: "#7440e6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}

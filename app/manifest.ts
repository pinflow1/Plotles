import type { MetadataRoute } from "next";

// What makes Plotless installable as an app: its name, icons and how it opens.
// Served at /manifest.webmanifest, which Google's Android wrapper reads.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Plotless",
    short_name: "Plotless",
    description: "A quiet place to write, alone or with other writers.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // The launch screen is black to match the icon; the status bar matches the app's own dark page.
    background_color: "#000000",
    theme_color: "#111111",
    lang: "en",
    categories: ["books", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "New story", short_name: "New story", url: "/projects/new" },
      { name: "Ideas", url: "/ideas" },
    ],
  } as MetadataRoute.Manifest;
}

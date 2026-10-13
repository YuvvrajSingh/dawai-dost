import type { MetadataRoute } from "next";

// Lets the app be added to the Home Screen; iPhone only allows web push for installed apps.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dawai Dost",
    short_name: "Dawai Dost",
    description: "Find the same medicine for less, and get told when it’s back in stock at your Jan Aushadhi Kendra.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0a7a52",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}

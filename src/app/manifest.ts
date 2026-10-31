import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Vedev.Guru Blog",
        short_name: "Vedev",
        start_url: "/",
        display: "standalone",
        background_color: "#fbf7f0",
        theme_color: "#2b2118",
        // Generated from the wordmark by src/scripts/generate-icons.mjs until the real logo arrives (DOC-07).
        icons: [
            { src: "/icon.ico", sizes: "256x256 64x64 48x48 32x32 16x16", type: "image/x-icon" },
            { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
            { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
    };
}

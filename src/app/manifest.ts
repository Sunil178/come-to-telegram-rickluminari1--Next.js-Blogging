import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: "Vedev.Guru Blog",
        short_name: "Vedev",
        start_url: "/",
        display: "standalone",
        background_color: "#ffffff",
        theme_color: "#000000",
        icons: [
            // The only icon asset that exists (src/app/icon.ico, served at /icon.ico). Chrome's install
            // prompt also wants 192x192 and 512x512 PNGs; push notifications don't need them.
            { src: "/icon.ico", sizes: "256x256 64x64 48x48 32x32 16x16", type: "image/x-icon" },
        ],
    };
}

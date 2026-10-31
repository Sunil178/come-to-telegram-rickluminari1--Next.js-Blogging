import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { SITE_URL } from "@/libs/site-url";

export default async function robots(): Promise<MetadataRoute.Robots> {
    // Render per request so the runtime SITE_URL is used, not the one present at build time.
    await connection();
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/dashboard", "/auth/", "/api/"],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}

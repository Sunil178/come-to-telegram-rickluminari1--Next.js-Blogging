import type { MetadataRoute } from "next";
import { SITE_URL } from "@/libs/site-url";

export default function robots(): MetadataRoute.Robots {
    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: ["/dashboard", "/auth/", "/api/"],
        },
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}

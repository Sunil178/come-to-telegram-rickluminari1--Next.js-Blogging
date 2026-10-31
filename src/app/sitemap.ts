import type { MetadataRoute } from "next";
import { connection } from "next/server";
import Post from "@/models/Post";
import { SITE_URL } from "@/libs/site-url";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    // Render per request: the build skips instrumentation's register(), so there is no DB connection to prerender with.
    await connection();
    const posts = await Post.find({ approval: "Approved", published: true, visibility: true })
        .select("slug updatedAt")
        .sort({ publishedAt: -1 })
        .lean();

    const staticRoutes: MetadataRoute.Sitemap = [
        { url: SITE_URL, changeFrequency: "daily", priority: 1 },
        { url: `${SITE_URL}/posts`, changeFrequency: "daily", priority: 0.9 },
    ];

    const postRoutes: MetadataRoute.Sitemap = posts.map((post) => ({
        url: `${SITE_URL}/posts/${post.slug}`,
        lastModified: post.updatedAt,
        changeFrequency: "weekly",
        priority: 0.7,
    }));

    return [...staticRoutes, ...postRoutes];
}

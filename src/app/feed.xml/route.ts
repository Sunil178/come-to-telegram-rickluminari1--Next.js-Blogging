import Post from "@/models/Post";
import User from "@/models/User";
import { SITE_URL } from "@/libs/site-url";

const FEED_SIZE = 30;

function escapeXml(value: string): string {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

export async function GET() {
    const posts = await Post.find({ approval: "Approved", published: true, visibility: true })
        .populate({ path: "userId", model: User, select: "username" })
        .select("slug title summary publishedAt")
        .sort({ publishedAt: -1 })
        .limit(FEED_SIZE)
        .lean();

    const items = posts
        .map((post) => {
            const url = `${SITE_URL}/posts/${post.slug}`;
            const author = (post.userId as unknown as { username?: string } | null)?.username;
            return `
    <item>
      <title>${escapeXml(post.title)}</title>
      <link>${url}</link>
      <guid isPermaLink="true">${url}</guid>
      <pubDate>${new Date(post.publishedAt).toUTCString()}</pubDate>
      ${post.summary ? `<description>${escapeXml(post.summary)}</description>` : ""}
      ${author ? `<dc:creator>${escapeXml(author)}</dc:creator>` : ""}
    </item>`;
        })
        .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Vedev.Guru</title>
    <link>${SITE_URL}</link>
    <description>Essays and deep dives on technology, culture, and the questions in between.</description>
    <language>en-us</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/feed.xml" rel="self" type="application/rss+xml" />${items}
  </channel>
</rss>`;

    return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}

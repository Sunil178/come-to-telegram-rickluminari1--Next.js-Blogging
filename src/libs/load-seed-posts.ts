import fs from "fs";
import path from "path";
import matter from "@11ty/gray-matter";
import type { ApprovalStatus } from "@/models/Post";

const POSTS_DIR = path.join(process.cwd(), "src", "seeds", "posts");

export interface SeedPostFixture {
    slug: string;
    categorySlug: string;
    title: string;
    titleDescription: string;
    tags: string[];
    bannerImage: string;
    summary: string;
    published: boolean;
    publishedAt: string;
    approval: ApprovalStatus;
    approvedAt?: string;
    visitorCount: number;
    markdownBody: string;
}

// One .md file per post (frontmatter metadata + markdown body) instead of the old
// single posts.json array — editing, adding, or removing a post is a single-file change.
export function loadSeedPosts(): SeedPostFixture[] {
    const files = fs.readdirSync(POSTS_DIR).filter((file) => file.endsWith(".md"));

    return files.map((file) => {
        const slug = file.replace(/\.md$/, "");
        const raw = fs.readFileSync(path.join(POSTS_DIR, file), "utf-8");
        const { data, content } = matter(raw);

        return {
            slug,
            categorySlug: data.categorySlug,
            title: data.title,
            titleDescription: data.titleDescription,
            tags: data.tags ?? [],
            bannerImage: data.bannerImage,
            summary: data.summary,
            published: data.published ?? true,
            publishedAt: data.publishedAt,
            approval: data.approval,
            approvedAt: data.approvedAt,
            visitorCount: data.visitorCount ?? 0,
            markdownBody: content.trim(),
        };
    });
}

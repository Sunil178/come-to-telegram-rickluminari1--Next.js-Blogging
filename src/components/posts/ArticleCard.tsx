import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import BannerImage from "@/components/posts/BannerImage";

export interface ArticleCardData {
    slug: string;
    title: string;
    excerpt: string;
    category?: string;
    bannerImage?: string;
    publishedAt?: string;
}

interface ArticleCardSourcePost {
    slug: string;
    title: string;
    titleDescription?: string;
    bannerImage?: string;
    publishedAt?: Date | string | null;
    categoryId?: { title?: string } | null;
}

export function toArticleCardData(post: ArticleCardSourcePost): ArticleCardData {
    return {
        slug: post.slug,
        title: post.title,
        excerpt: post.titleDescription || "",
        category: post.categoryId?.title,
        bannerImage: post.bannerImage || undefined,
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
    };
}

export default function ArticleCard({ article }: { article: ArticleCardData }) {
    return (
        <Link href={`/posts/${article.slug}`} className="block h-full">
            <Card className="h-full gap-3 overflow-hidden border-none py-0 shadow-none ring-1 ring-border transition-shadow hover:shadow-md">
                {article.bannerImage && <BannerImage src={article.bannerImage} />}
                <CardHeader className="gap-2 pt-6">
                    <div className="flex items-center justify-between font-mono text-[11px] tracking-widest uppercase">
                        {article.category && <span className="text-teal">{article.category}</span>}
                        {article.publishedAt && (
                            <span className="text-muted-foreground">
                                {new Date(article.publishedAt).toLocaleDateString("en-US", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                })}
                            </span>
                        )}
                    </div>
                    <h3 className="font-heading text-2xl font-semibold text-foreground">{article.title}</h3>
                </CardHeader>
                <CardContent className="pb-6">
                    <p className="line-clamp-3 text-sm text-muted-foreground">{article.excerpt}</p>
                </CardContent>
            </Card>
        </Link>
    );
}

import Link from "next/link";
import { notFound } from "next/navigation";
import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { isValidObjectId } from "mongoose";
import Post from "@/models/Post";
import PostRevision from "@/models/PostRevision";
import User from "@/models/User";
import { getSession, type AuthenticatedSession } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { MAX_REVISIONS_PER_POST } from "@/libs/post-revisions";
import RestoreRevisionButton from "@/components/posts/RestoreRevisionButton";

export const metadata = { title: "Revision history", robots: { index: false } };

interface RevisionsPageProps {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ r?: string }>;
}

export default async function RevisionsPage({ params, searchParams }: RevisionsPageProps) {
    const { slug } = await params;
    const { r: selectedId } = await searchParams;
    // proxy.ts (isGatedPath) redirects unauthenticated requests before this renders.
    const session = (await getSession()) as AuthenticatedSession;
    const isAdmin = hasRole(session.user.role, ROLES.ADMIN);
    const post = await Post.findOne(isAdmin ? { slug } : { slug, userId: session.user.id }).select("_id slug title").lean();
    if (!post) notFound();

    const revisions = await PostRevision.find({ postId: post._id })
        .sort({ createdAt: -1 })
        .populate({ path: "editorId", model: User, select: "username" })
        .select("title createdAt editorId")
        .lean();
    const selected = selectedId && isValidObjectId(selectedId)
        ? await PostRevision.findOne({ _id: selectedId, postId: post._id }).lean()
        : null;

    let previewHtml = "";
    if (selected) {
        const window = new JSDOM("").window;
        previewHtml = DOMPurify(window as unknown as Window & typeof globalThis).sanitize(selected.content || "");
    }

    return (
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-10 lg:grid-cols-[18rem_minmax(0,1fr)]">
            <aside>
                <h1 className="font-heading text-2xl font-semibold text-foreground">Revision history</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    <Link href={`/posts/${post.slug}/edit`} className="text-primary hover:underline">{post.title}</Link>
                    {" "}· versions before each edit, newest first (last {MAX_REVISIONS_PER_POST} kept).
                </p>
                {revisions.length === 0 ? (
                    <p className="mt-6 text-sm text-muted-foreground">No earlier versions yet. Each save keeps the version it replaces.</p>
                ) : (
                    <ol className="mt-4 divide-y divide-border rounded-lg border border-border bg-card">
                        {revisions.map((revision) => {
                            const id = revision._id.toString();
                            const editor = revision.editorId as unknown as { username?: string } | null;
                            return (
                                <li key={id}>
                                    <Link
                                        href={`?r=${id}`}
                                        aria-current={id === selectedId ? "true" : undefined}
                                        className={`block px-3 py-2 text-sm hover:bg-accent ${id === selectedId ? "bg-muted" : ""}`}
                                    >
                                        <span className="block text-foreground">{new Date(revision.createdAt).toLocaleString("en-US")}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            replaced by {editor?.username ?? "unknown"} · {revision.title}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ol>
                )}
            </aside>
            <section aria-label="Revision preview">
                {selected ? (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-4">
                            <h2 className="font-heading text-3xl font-semibold text-foreground">{selected.title}</h2>
                            <RestoreRevisionButton slug={post.slug} revisionId={selected._id.toString()} />
                        </div>
                        {selected.titleDescription && <p className="mt-2 text-muted-foreground">{selected.titleDescription}</p>}
                        <article className="prose mt-6 max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: previewHtml }} />
                    </>
                ) : (
                    <p className="text-sm text-muted-foreground">Select a version to preview or restore it.</p>
                )}
            </section>
        </div>
    );
}

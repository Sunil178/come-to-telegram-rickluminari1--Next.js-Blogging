"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { PostEditor, usePostEditor } from "@/components/editor/PostEditor";
import PostBannerUpload from "@/components/posts/PostBannerUpload";
import TagInput from "@/components/posts/TagInput";
import { slugify } from "@/libs/slug";
import { loginRedirectUrl } from "@/libs/auth-redirect";
import { draftKey as buildDraftKey, pendingKey, readDraft, removeDraft, withoutNodeIds, writeDraft, type Draft } from "@/libs/post-drafts";

interface InitialPost {
    slug: string;
    title: string;
    titleDescription: string;
    tags: string[];
    bannerImage: string;
    contentHtml: string;
    publishAt: string | null;
    categoryId: string | null;
}

export interface CategoryOption {
    id: string;
    title: string;
}

// <input type="datetime-local"> works in local time without a zone; the API takes an ISO timestamp.
function toLocalInputValue(iso: string | null | undefined): string {
    if (!iso) return "";
    const date = new Date(iso);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

// Autosaved to this browser while editing, so a crash, closed tab or expired session doesn't lose work.
const AUTOSAVE_DELAY_MS = 1000;

interface PostFormProps {
    mode: "create" | "edit";
    userId: string;
    initialPost?: InitialPost;
    // Already public: its publish time can no longer be changed (that would take a live post down unmoderated).
    isLive?: boolean;
    categories: CategoryOption[];
}

export default function PostForm({ mode, userId, initialPost, isLive = false, categories }: PostFormProps) {
    const router = useRouter();
    const editor = usePostEditor(initialPost?.contentHtml);

    const [title, setTitle] = useState(initialPost?.title ?? "");
    const [titleDescription, setTitleDescription] = useState(initialPost?.titleDescription ?? "");
    const [slug, setSlug] = useState(initialPost?.slug ?? "");
    const [slugEdited, setSlugEdited] = useState(mode === "edit");
    const [tags, setTags] = useState<string[]>(initialPost?.tags ?? []);
    // A category that's no longer offered (deleted or hidden) reads as none, so saving can't resend it.
    const [categoryId, setCategoryId] = useState(() =>
        categories.some((category) => category.id === initialPost?.categoryId) ? initialPost!.categoryId! : ""
    );
    const [bannerImage, setBannerImage] = useState(initialPost?.bannerImage ?? "");
    // Filled after mount: the local-time value depends on the browser's timezone, not the server's.
    // The field stays disabled until then, so an edit made earlier can't be overwritten by it.
    const [publishAt, setPublishAt] = useState("");
    const [publishAtReady, setPublishAtReady] = useState(false);
    useEffect(() => {
        const initial = toLocalInputValue(initialPost?.publishAt);
        Promise.resolve().then(() => {
            setPublishAt(initial);
            setPublishAtReady(true);
        });
    }, [initialPost?.publishAt]);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const draftKey = buildDraftKey(userId, mode === "edit" ? initialPost!.slug : null);
    const [pendingDraft, setPendingDraft] = useState<Draft | null>(null);
    const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
    const [contentVersion, setContentVersion] = useState(0);
    // Only real input autosaves: loading the post into the editor also fires a value change, and must
    // not overwrite a draft the author hasn't decided to restore yet.
    const userEdited = useRef(false);
    // Set once the post is saved, so a still-pending autosave can't write the draft back.
    const saved = useRef(false);

    useEffect(() => {
        // The newest undecided draft: a main-key autosave, or one parked while an earlier banner was up.
        const candidates = [readDraft(draftKey), readDraft(pendingKey(draftKey))].filter((d): d is Draft => d !== null);
        const draft = candidates.sort((a, b) => b.savedAt - a.savedAt)[0];
        removeDraft(draftKey);
        removeDraft(pendingKey(draftKey));
        if (!draft) return;
        // A draft identical to the saved post (e.g. a click that changed nothing) isn't worth offering.
        // usePostEditor's effect has already loaded the post's content by now.
        const unchanged =
            draft.title === (initialPost?.title ?? "") &&
            draft.titleDescription === (initialPost?.titleDescription ?? "") &&
            draft.slug === (initialPost?.slug ?? "") &&
            JSON.stringify(draft.tags) === JSON.stringify(initialPost?.tags ?? []) &&
            draft.bannerImage === (initialPost?.bannerImage ?? "") &&
            draft.publishAt === toLocalInputValue(initialPost?.publishAt) &&
            JSON.stringify(withoutNodeIds(draft.content)) === JSON.stringify(withoutNodeIds(editor.children));
        if (unchanged) return;
        // Parked under its own key until the author decides, so autosaves meanwhile can't overwrite it.
        writeDraft(pendingKey(draftKey), draft);
        Promise.resolve().then(() => setPendingDraft(draft));
        // Runs once per post; initialPost and editor are stable for its lifetime.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey]);

    useEffect(() => {
        // Keeps saving while the restore banner is up; the undecided draft is parked under pendingKey.
        if (!userEdited.current) return;
        const timer = setTimeout(() => {
            if (saved.current) return;
            const draft: Draft = { savedAt: Date.now(), title, titleDescription, slug, tags, bannerImage, publishAt, content: editor.children };
            if (writeDraft(draftKey, draft)) setDraftSavedAt(draft.savedAt);
        }, AUTOSAVE_DELAY_MS);
        return () => clearTimeout(timer);
    }, [draftKey, title, titleDescription, slug, tags, bannerImage, publishAt, contentVersion, editor]);

    const restoreDraft = () => {
        if (!pendingDraft) return;
        setTitle(pendingDraft.title);
        setTitleDescription(pendingDraft.titleDescription);
        setSlug(pendingDraft.slug);
        setSlugEdited(true);
        setTags(pendingDraft.tags);
        setBannerImage(pendingDraft.bannerImage);
        setPublishAt(pendingDraft.publishAt);
        editor.tf.setValue(pendingDraft.content);
        // Saved back under the main key right away, so a reload before the next autosave keeps it.
        writeDraft(draftKey, { ...pendingDraft, savedAt: Date.now() });
        removeDraft(pendingKey(draftKey));
        setPendingDraft(null);
        userEdited.current = true;
    };

    const discardDraft = () => {
        removeDraft(pendingKey(draftKey));
        setPendingDraft(null);
        // The click itself isn't an edit; don't autosave the untouched post as a new draft.
        userEdited.current = false;
    };

    const handleTitleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
        setTitle(event.target.value);
        if (!slugEdited) setSlug(slugify(event.target.value));
    };

    const handleSlugChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setSlugEdited(true);
        setSlug(event.target.value);
    };

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError("");
        setSubmitting(true);

        try {
            const formData = new FormData();
            formData.set("title", title);
            formData.set("slug", slug);
            formData.set("titleDescription", titleDescription);
            formData.set("tags", tags.join(","));
            formData.set("categoryId", categoryId);
            formData.set("postBannerPath", bannerImage);
            formData.set("post_data", JSON.stringify(editor.children));
            formData.set("publishAt", publishAt ? new Date(publishAt).toISOString() : "");

            const url = mode === "create" ? "/api/posts" : `/api/posts/${initialPost!.slug}`;
            const response = await fetch(url, {
                method: mode === "create" ? "POST" : "PATCH",
                body: formData,
            });

            if (response.status === 401) {
                router.push(loginRedirectUrl(location.pathname));
                return;
            }

            const result = await response.json();
            if (!response.ok) {
                setError(result.message || "Something went wrong. Please try again.");
                return;
            }

            saved.current = true;
            removeDraft(draftKey);
            removeDraft(pendingKey(draftKey));
            router.push("/dashboard/posts");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            // Typing, and clicks such as toolbar formatting, tag removal or banner changes, count as edits.
            onInput={() => (userEdited.current = true)}
            onKeyDown={() => (userEdited.current = true)}
            onPointerDown={() => (userEdited.current = true)}
            method="post"
            className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10"
        >
            <h1 className="font-heading text-2xl font-semibold text-foreground">
                {mode === "create" ? "New post" : "Edit post"}
            </h1>

            {pendingDraft && (
                <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-foreground">
                    <span>You have an unsaved draft from {new Date(pendingDraft.savedAt).toLocaleString("en-US")}.</span>
                    <span className="flex gap-2">
                        <Button type="button" size="sm" onClick={restoreDraft}>Restore draft</Button>
                        <Button type="button" size="sm" variant="outline" onClick={discardDraft}>Discard</Button>
                    </span>
                </div>
            )}

            {error && (
                <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                </p>
            )}

            <div className="flex flex-col gap-2">
                <Label>Banner</Label>
                <PostBannerUpload value={bannerImage} onChange={setBannerImage} />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-title">Title</Label>
                <Textarea id="post-title" value={title} onChange={handleTitleChange} placeholder="Post title…" required />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-description">Description</Label>
                <Textarea
                    id="post-description"
                    value={titleDescription}
                    onChange={(e) => setTitleDescription(e.target.value)}
                    placeholder="A short summary shown in previews…"
                />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-slug">URL slug</Label>
                <Input id="post-slug" value={slug} onChange={handleSlugChange} placeholder="post-url-slug" required />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-category">Category</Label>
                <select
                    id="post-category"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                    <option value="">No category</option>
                    {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                            {category.title}
                        </option>
                    ))}
                </select>
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-tags">Tags</Label>
                <TagInput id="post-tags" value={tags} onChange={setTags} />
            </div>

            <div className="flex flex-col gap-2">
                <Label htmlFor="post-publish-at">Publish at (optional)</Label>
                <Input
                    id="post-publish-at"
                    type="datetime-local"
                    value={publishAt}
                    onChange={(e) => setPublishAt(e.target.value)}
                    disabled={isLive || !publishAtReady}
                    className="w-fit"
                />
                <p className="text-xs text-muted-foreground">
                    {isLive
                        ? "This post is already published, so its publish time can't change."
                        : "Leave empty to publish as soon as a moderator approves it. A future time keeps the approved post hidden until then."}
                </p>
            </div>

            <div className="flex flex-col gap-2">
                <Label>Content</Label>
                <div className="overflow-hidden rounded-lg border border-input">
                    <PostEditor editor={editor} onValueChange={() => setContentVersion((version) => version + 1)} />
                </div>
            </div>

            <div className="flex items-center justify-end gap-4">
                {draftSavedAt && (
                    <span className="text-xs text-muted-foreground" aria-live="polite">
                        Draft saved at {new Date(draftSavedAt).toLocaleTimeString("en-US")}
                    </span>
                )}
                <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? "Publishing…" : mode === "create" ? "Publish" : "Save changes"}
                </Button>
            </div>
        </form>
    );
}

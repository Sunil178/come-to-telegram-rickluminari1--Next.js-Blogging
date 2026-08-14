"use client";

import { useState, type FormEvent } from "react";
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

interface InitialPost {
    slug: string;
    title: string;
    titleDescription: string;
    tags: string[];
    bannerImage: string;
    contentHtml: string;
}

interface PostFormProps {
    mode: "create" | "edit";
    initialPost?: InitialPost;
}

export default function PostForm({ mode, initialPost }: PostFormProps) {
    const router = useRouter();
    const editor = usePostEditor(initialPost?.contentHtml);

    const [title, setTitle] = useState(initialPost?.title ?? "");
    const [titleDescription, setTitleDescription] = useState(initialPost?.titleDescription ?? "");
    const [slug, setSlug] = useState(initialPost?.slug ?? "");
    const [slugEdited, setSlugEdited] = useState(mode === "edit");
    const [tags, setTags] = useState<string[]>(initialPost?.tags ?? []);
    const [bannerImage, setBannerImage] = useState(initialPost?.bannerImage ?? "");
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);

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
            formData.set("postBannerPath", bannerImage);
            formData.set("post_data", JSON.stringify(editor.children));

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

            router.push("/dashboard/posts");
            router.refresh();
        } catch {
            setError("Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
                {mode === "create" ? "New post" : "Edit post"}
            </h1>

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
                <Label htmlFor="post-tags">Tags</Label>
                <TagInput id="post-tags" value={tags} onChange={setTags} />
            </div>

            <div className="flex flex-col gap-2">
                <Label>Content</Label>
                <div className="overflow-hidden rounded-lg border border-input">
                    <PostEditor editor={editor} />
                </div>
            </div>

            <div className="flex justify-end">
                <Button type="submit" size="lg" disabled={submitting}>
                    {submitting ? "Publishing…" : mode === "create" ? "Publish" : "Save changes"}
                </Button>
            </div>
        </form>
    );
}

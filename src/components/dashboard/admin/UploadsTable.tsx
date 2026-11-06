"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import ConfirmIconButton from "@/components/ConfirmIconButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface UploadRow {
    url: string;
    size: string;
    date: string;
    used: boolean;
    recent: boolean;
    uploader: string | null;
    details: [string, string][];
    mapUrl: string | null;
    private: boolean;
}

const downloadHref = (urls: string[]) => `/api/uploads/download?${new URLSearchParams(urls.map((url) => ["url", url])).toString()}`;

export default function UploadsTable({ rows, deletableCount }: { rows: UploadRow[]; deletableCount: number }) {
    const router = useRouter();
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [pending, startTransition] = useTransition();
    const chosen = rows.filter((row) => selected.has(row.url)).map((row) => row.url);
    const allChosen = rows.length > 0 && chosen.length === rows.length;

    const toggle = (url: string, on: boolean) =>
        setSelected((current) => {
            const next = new Set(current);
            if (on) next.add(url);
            else next.delete(url);
            return next;
        });

    const remove = (body: { urls: string[] } | { all: true }) =>
        startTransition(async () => {
            try {
                const response = await fetch("/api/uploads", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
                const result = await response.json().catch(() => null);
                if (!response.ok) {
                    toast.error(result?.message ?? "Couldn't delete the files.");
                    return;
                }
                const { deleted, inUse, recent } = result.data as { deleted: string[]; inUse: string[]; recent: string[] };
                const kept = [inUse.length && `${inUse.length} in use`, recent.length && `${recent.length} under a day old`].filter(Boolean).join(", ");
                toast.success(`Deleted ${deleted.length} file${deleted.length === 1 ? "" : "s"}.${kept ? ` Kept ${kept}.` : ""}`);
                setSelected(new Set());
                router.refresh();
            } catch {
                toast.error("Couldn't delete the files.");
            }
        });

    return (
        <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
                {chosen.length > 0 ? (
                    <Button variant="outline" size="sm" asChild>
                        <a href={downloadHref(chosen)}>
                            <Download /> Download selected ({chosen.length})
                        </a>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        <Download /> Download selected (0)
                    </Button>
                )}
                <ConfirmIconButton
                    icon={<Trash2 />}
                    label={`Delete selected (${chosen.length})`}
                    showLabel
                    title={`Delete ${chosen.length} selected file${chosen.length === 1 ? "" : "s"}?`}
                    description="The files are removed from disk for good. Files still in use, and new ones under a day old, are kept."
                    confirmLabel="Delete"
                    disabled={pending || chosen.length === 0}
                    onConfirm={() => remove({ urls: chosen })}
                />
                <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
                {deletableCount > 0 && (
                    <>
                        <Button variant="outline" size="sm" asChild>
                            <a href="/api/uploads/download?scope=unused">
                                <Download /> Download all unused ({deletableCount})
                            </a>
                        </Button>
                        <ConfirmIconButton
                            icon={<Trash2 />}
                            label={`Delete all unused (${deletableCount})`}
                            showLabel
                            title={`Delete all ${deletableCount} unused files?`}
                            description="Every file nothing uses, except new ones under a day old, is removed from disk for good. Download them first if you might need them."
                            confirmLabel="Delete all"
                            disabled={pending}
                            onConfirm={() => remove({ all: true })}
                        />
                    </>
                )}
            </div>

            <div className="overflow-x-auto rounded-xl ring-1 ring-border">
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="w-10">
                                <Checkbox
                                    aria-label="Select all on this page"
                                    checked={allChosen}
                                    disabled={rows.length === 0}
                                    onCheckedChange={(on) => setSelected(on ? new Set(rows.map((row) => row.url)) : new Set())}
                                />
                            </TableHead>
                            <TableHead>File</TableHead>
                            <TableHead>Size</TableHead>
                            <TableHead>Uploaded</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((row) => (
                            <TableRow key={row.url}>
                                <TableCell className="align-top">
                                    <Checkbox aria-label={`Select ${row.url}`} checked={selected.has(row.url)} onCheckedChange={(on) => toggle(row.url, on === true)} />
                                </TableCell>
                                <TableCell className="align-top">
                                    <div className="flex items-start gap-3">
                                        {row.private ? (
                                            <span className="flex size-12 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground ring-1 ring-border">Private</span>
                                        ) : (
                                            // eslint-disable-next-line @next/next/no-img-element -- small admin preview of a local upload
                                            <img src={row.url} alt="" loading="lazy" className="size-12 shrink-0 rounded object-cover ring-1 ring-border" />
                                        )}
                                        <div className="min-w-0">
                                            {row.private ? (
                                                <span className="block max-w-xs truncate font-mono text-xs">{row.url}</span>
                                            ) : (
                                                <a href={row.url} target="_blank" rel="noreferrer" className="block max-w-xs truncate font-mono text-xs text-primary hover:underline">
                                                    {row.url}
                                                </a>
                                            )}
                                            {row.details.length > 0 && (
                                                <details className="mt-1 text-xs text-muted-foreground">
                                                    <summary className="cursor-pointer">Details</summary>
                                                    <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
                                                        {row.details.map(([label, value]) => (
                                                            <div key={label} className="contents">
                                                                <dt>{label}</dt>
                                                                <dd className="text-foreground">{value}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                    {row.mapUrl && (
                                                        <a href={row.mapUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                                                            Show where it was taken
                                                        </a>
                                                    )}
                                                </details>
                                            )}
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="align-top whitespace-nowrap">{row.size}</TableCell>
                                <TableCell className="align-top">
                                    <div className="whitespace-nowrap">{row.date}</div>
                                    <div className="text-xs text-muted-foreground">{row.uploader ? `by ${row.uploader}` : "uploader not recorded"}</div>
                                </TableCell>
                                <TableCell className="align-top">
                                    <Badge variant={row.used ? "secondary" : "outline"} title={row.recent ? "Under a day old: may be in a post that isn't saved yet" : undefined}>
                                        {row.used ? "In use" : row.recent ? "New" : "Unused"}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right align-top whitespace-nowrap">
                                    <Button variant="ghost" size="icon-sm" asChild>
                                        <a href={downloadHref([row.url])} aria-label={`Download ${row.url}`}>
                                            <Download />
                                        </a>
                                    </Button>
                                    <ConfirmIconButton
                                        icon={<Trash2 />}
                                        label={`Delete ${row.url}`}
                                        title="Delete this file?"
                                        description="It's removed from disk for good."
                                        confirmLabel="Delete"
                                        disabled={pending || row.used || row.recent}
                                        onConfirm={() => remove({ urls: [row.url] })}
                                    />
                                </TableCell>
                            </TableRow>
                        ))}
                        {rows.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                                    No files here.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

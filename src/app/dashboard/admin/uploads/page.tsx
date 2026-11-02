import Link from "next/link";
import PostsPagination from "@/components/posts/PostsPagination";
import UploadsTable, { type UploadRow } from "@/components/dashboard/admin/UploadsTable";
import { buildSearchParamsHref } from "@/libs/build-href";
import { firstParam, parsePageParam, type SearchParamValue } from "@/libs/search-params";
import { listUploads, type UploadFile } from "@/libs/upload-cleanup";
import { cn } from "@/lib/utils";

export const metadata = { title: "Uploads" };

const PAGE_SIZE = 50;
const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" });

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function toRow(file: UploadFile): UploadRow {
    const record = file.record;
    const meta = record?.metadata;
    const details: [string, string | undefined | false][] = [
        ["Used for", record?.purpose === "avatar" ? "Profile photo" : record?.purpose === "post" ? "Post image" : undefined],
        ["Dimensions", record?.width && record.height ? `${record.width} × ${record.height}` : undefined],
        ["Original size", record ? formatSize(record.originalSize) : undefined],
        ["Camera", [meta?.make, meta?.model].filter(Boolean).join(" ") || undefined],
        ["Lens", meta?.lens],
        ["Software", meta?.software],
        ["Taken", meta?.takenAt && `${dateFormat.format(new Date(meta.takenAt))} UTC`],
        ["Location", meta?.gps && `${meta.gps.latitude.toFixed(5)}, ${meta.gps.longitude.toFixed(5)}`],
    ];
    return {
        url: file.url,
        size: formatSize(file.size),
        date: `${dateFormat.format(record?.createdAt ? new Date(record.createdAt) : file.modifiedAt)} UTC`,
        used: file.used,
        recent: file.recent,
        uploader: record?.uploader ?? null,
        details: details.filter((entry): entry is [string, string] => Boolean(entry[1])),
        mapUrl: meta?.gps ? `https://www.openstreetmap.org/?mlat=${meta.gps.latitude}&mlon=${meta.gps.longitude}#map=15/${meta.gps.latitude}/${meta.gps.longitude}` : null,
    };
}

interface AdminUploadsPageProps {
    searchParams: Promise<{ page?: SearchParamValue; show?: SearchParamValue }>;
}

export default async function AdminUploadsPage({ searchParams }: AdminUploadsPageProps) {
    const params = await searchParams;
    const show = firstParam(params.show) === "all" ? "all" : "unused";
    const page = parsePageParam(params.page);
    const files = await listUploads();
    const unused = files.filter((file) => !file.used);
    const deletable = unused.filter((file) => !file.recent);
    const shown = show === "all" ? files : unused;
    const totalPages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
    const rows = shown.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(toRow);
    const sum = (list: UploadFile[]) => formatSize(list.reduce((total, file) => total + file.size, 0));
    const buildHref = ({ page: next }: { page: number }) => buildSearchParamsHref("/dashboard/admin/uploads", { show: show === "all" ? "all" : undefined, page: next > 1 ? next : undefined });

    return (
        <div className="mx-auto max-w-6xl px-6 py-10">
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-foreground">Uploads</h1>
            <p className="mt-2 text-muted-foreground">
                {files.length} files ({sum(files)}); {unused.length} unused ({sum(unused)}). A file is unused when no post, draft, deleted post, earlier revision or profile photo refers to it. Unused files under a day old are marked new and kept, as they may be in a post that isn&apos;t saved yet.
            </p>
            <nav className="mt-6 flex gap-1" aria-label="Which files">
                {(["unused", "all"] as const).map((option) => (
                    <Link
                        key={option}
                        href={option === "all" ? "/dashboard/admin/uploads?show=all" : "/dashboard/admin/uploads"}
                        aria-current={show === option ? "page" : undefined}
                        className={cn("rounded-md px-3 py-1.5 text-sm", show === option ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}
                    >
                        {option === "all" ? `All (${files.length})` : `Unused (${unused.length})`}
                    </Link>
                ))}
            </nav>
            <div className="mt-4">
                <UploadsTable key={`${show}-${page}`} rows={rows} deletableCount={deletable.length} />
            </div>
            <PostsPagination page={page} totalPages={totalPages} buildHref={buildHref} className="mt-8" />
        </div>
    );
}

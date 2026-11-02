"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function PostsSearch() {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const urlQuery = searchParams.get("q") ?? "";
    const [value, setValue] = useState(urlQuery);
    // The URL query last seen, then the current one followed by the queries still on their way.
    const [seenQuery, setSeenQuery] = useState(urlQuery);
    const [sentQueries, setSentQueries] = useState<string[]>([urlQuery]);
    const lastSent = sentQueries[sentQueries.length - 1];

    // Only a navigation the box didn't make (a nav link, the back button) resets it. Its own results
    // arriving while the user keeps typing must not overwrite what they typed since.
    if (urlQuery !== seenQuery) {
        setSeenQuery(urlQuery);
        const own = sentQueries.lastIndexOf(urlQuery);
        if (own === -1) {
            setSentQueries([urlQuery]);
            setValue(urlQuery);
        } else {
            setSentQueries(sentQueries.slice(own));
        }
    }

    useEffect(() => {
        const query = value.trim();
        if (query === lastSent) return;
        const timeout = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (query) {
                params.set("q", query);
            } else {
                params.delete("q");
            }
            params.delete("page");
            setSentQueries((queries) => [...queries, query]);
            const search = params.toString();
            // Replace, not push: each pause while typing would otherwise add a history entry.
            router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
        }, 400);
        return () => clearTimeout(timeout);
        // Only typing re-triggers the debounce; searchParams changes come from this navigation itself.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                type="search"
                aria-label="Search articles"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search articles..."
                className="pl-9"
            />
        </div>
    );
}

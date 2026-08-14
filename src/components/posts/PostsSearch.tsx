"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function PostsSearch({ defaultValue }: { defaultValue: string }) {
    const [value, setValue] = useState(defaultValue);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    useEffect(() => {
        const timeout = setTimeout(() => {
            const params = new URLSearchParams(searchParams.toString());
            if (value) {
                params.set("q", value);
            } else {
                params.delete("q");
            }
            params.delete("page");
            router.push(`${pathname}?${params.toString()}`);
        }, 400);
        return () => clearTimeout(timeout);
        // Only the debounced input value should re-trigger this navigation;
        // re-running on every searchParams change (including the push above) would loop.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value]);

    return (
        <div className="relative w-full max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
                aria-label="Search articles"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="Search articles..."
                className="pl-9"
            />
        </div>
    );
}

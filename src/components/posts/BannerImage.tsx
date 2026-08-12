"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface BannerImageProps {
    src: string;
    className?: string;
    sizes?: string;
    priority?: boolean;
}

export default function BannerImage({ src, className, sizes, priority }: BannerImageProps) {
    const [error, setError] = useState(false);
    if (error) return null;

    return (
        <div className={cn("relative aspect-video w-full overflow-hidden", className)}>
            <Image
                src={src}
                alt=""
                fill
                priority={priority}
                sizes={sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
                className="object-cover"
                onError={() => setError(true)}
            />
        </div>
    );
}

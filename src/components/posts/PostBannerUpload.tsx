"use client";

import { useRef } from "react";
import Image from "next/image";
import { ImagePlus, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUploadFile } from "@/hooks/use-upload-file";

interface PostBannerUploadProps {
    value: string;
    onChange: (url: string) => void;
}

export default function PostBannerUpload({ value, onChange }: PostBannerUploadProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const { uploadFile, isUploading } = useUploadFile({
        onUploadComplete: (file) => onChange(file.url),
    });

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) void uploadFile(file);
        event.target.value = "";
    };

    return (
        <div
            className={cn(
                "group relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-input bg-muted/40",
                value && "border-solid"
            )}
        >
            {value && <Image src={value} alt="" fill className="object-cover" />}

            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

            {isUploading ? (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </div>
            ) : value ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 bg-background/0 opacity-0 transition-opacity group-hover:bg-background/50 group-hover:opacity-100">
                    <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
                        <ImagePlus /> Replace
                    </Button>
                    <Button type="button" variant="destructive" size="sm" onClick={() => onChange("")}>
                        <X /> Remove
                    </Button>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="flex cursor-pointer flex-col items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
                >
                    <ImagePlus className="size-6" />
                    Add a banner image
                </button>
            )}
        </div>
    );
}

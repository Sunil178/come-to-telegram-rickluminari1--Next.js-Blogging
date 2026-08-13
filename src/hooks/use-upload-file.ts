import { useCallback, useState } from 'react';

import { toast } from 'sonner';

export interface UploadedFile {
    key: string;
    url: string;
    name: string;
    size: number;
    type: string;
}

interface UploadResponse {
    data: string | null;
    location: string | null;
    message: string;
}

interface UseUploadFileProps {
    onUploadComplete?: (file: UploadedFile) => void;
    onUploadError?: (error: Error) => void;
}

// Uploads through this app's own hardened /api/posts/upload endpoint
// (auth + MIME allowlist + size cap, see that route for details) rather
// than a third-party service — uploads stay on local disk per this app's
// storage decision. Used by both the in-editor image tool and the post
// banner uploader, so there's one upload code path, not two.
export function useUploadFile({ onUploadComplete, onUploadError }: UseUploadFileProps = {}) {
    const [uploadedFile, setUploadedFile] = useState<UploadedFile>();
    const [uploadingFile, setUploadingFile] = useState<File>();
    const [isUploading, setIsUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const uploadFile = useCallback(
        async (file: File) => {
            setIsUploading(true);
            setUploadingFile(file);
            setProgress(0);

            try {
                const body = new FormData();
                body.append('file', file);
                const response = await fetch('/api/posts/upload', { method: 'POST', body });
                const result: UploadResponse = await response.json();

                if (!response.ok || !result.location) {
                    throw new Error(result.message || 'Upload failed');
                }

                const uploaded: UploadedFile = {
                    key: result.location,
                    url: result.location,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                };
                setUploadedFile(uploaded);
                setProgress(100);
                onUploadComplete?.(uploaded);
                return uploaded;
            } catch (err) {
                const error = err instanceof Error ? err : new Error('Upload failed');
                toast.error(error.message);
                onUploadError?.(error);
                return undefined;
            } finally {
                setIsUploading(false);
            }
        },
        [onUploadComplete, onUploadError]
    );

    return { uploadFile, uploadingFile, uploadedFile, isUploading, progress };
}

export function showErrorToast(err: unknown) {
    const message = err instanceof Error ? err.message : 'Something went wrong, please try again later.';
    return toast.error(message);
}

export function buildSearchParamsHref(basePath: string, params: Record<string, string | number | undefined>): string {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
        if (value) usp.set(key, String(value));
    });
    const qs = usp.toString();
    return qs ? `${basePath}?${qs}` : basePath;
}

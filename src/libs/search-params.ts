// Next passes a repeated query parameter (?q=a&q=b) as an array; pages read the first value.
export type SearchParamValue = string | string[] | undefined;

export function firstParam(value: SearchParamValue): string | undefined {
    return Array.isArray(value) ? value[0] : value;
}

export function parsePageParam(value: SearchParamValue): number {
    return Math.max(1, parseInt(firstParam(value) || "1", 10) || 1);
}

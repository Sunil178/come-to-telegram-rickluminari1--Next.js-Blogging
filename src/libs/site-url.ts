import { runtimeEnv } from "@/libs/runtime-config";

// Backs metadataBase, sitemap/robots/RSS links, and OG image resolution — all need one
// absolute origin, set per environment via SITE_URL (read at runtime; server-only).
export const SITE_URL = runtimeEnv("SITE_URL") || "http://localhost:5000";

// Backs metadataBase, sitemap/robots/RSS links, and OG image resolution — all need one
// absolute origin, set per environment via NEXT_PUBLIC_SITE_URL in production.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:5000";

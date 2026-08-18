import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import Post from "@/models/Post";
import PostView, { VIEW_DEDUPE_SECONDS } from "@/models/PostView";
import { withApiGuard } from "@/libs/api-guard";
import { getClientIp, hashIp } from "@/libs/client-ip";

interface RouteContext {
    params: Promise<{ slug: string }>;
}

// Ops-tunable, not a product constant -- lets a limit be tightened mid-incident without a redeploy.
const RATE_LIMIT_POINTS = Number(process.env.VIEW_RATE_LIMIT_POINTS) || 20;
const RATE_LIMIT_DURATION_SECONDS = Number(process.env.VIEW_RATE_LIMIT_DURATION_SECONDS) || 60;

export const POST = withApiGuard<RouteContext>(
    async (request: NextRequest, { params }) => {
        try {
            const { slug } = await params;
            const cookieName = `viewed:${slug}`;
            const response = NextResponse.json({ data: null, message: "Success" });

            // Fast path: a cookie-bearing browser skips the DB round-trip entirely.
            if (request.cookies.get(cookieName)) {
                return response;
            }

            // Real gate: the (slug, ipHash) unique index is atomic, so neither a cookie-less
            // script nor a concurrent request racing this one can double-count.
            let isNewView = true;
            try {
                await PostView.create({ slug, ipHash: hashIp(getClientIp(request)) });
            } catch (error) {
                if ((error as { code?: number }).code !== 11000) throw error;
                isNewView = false;
            }

            // Only publicly visible posts accrue views, so an owner/moderator previewing an
            // unapproved post doesn't inflate the count before it's ever actually public.
            if (isNewView) {
                await Post.updateOne(
                    { slug, approval: "Approved", published: true, visibility: true },
                    { $inc: { visitorCount: 1 } }
                );
            }

            response.cookies.set(cookieName, "1", {
                maxAge: VIEW_DEDUPE_SECONDS,
                httpOnly: true,
                sameSite: "lax",
                path: "/",
            });
            return response;
        } catch (error) {
            console.error("Failed to record post view:", error);
            return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
        }
    },
    { auth: false, rateLimit: { points: RATE_LIMIT_POINTS, duration: RATE_LIMIT_DURATION_SECONDS } }
);

import { after, NextResponse } from "next/server";
import PublishRequest from "@/models/PublishRequest";
import User from "@/models/User";
import { withApiGuard } from "@/libs/api-guard";
import { hasRole, ROLES } from "@/libs/roles";
import { logger } from "@/libs/logger";
import { notify } from "@/libs/notify";
import { markRequestNotificationsRead } from "@/libs/review-notifications";
import { parseProfileInput } from "@/libs/profile";
import { saveProfileFields } from "@/libs/profile-store";
import { APPLICATION_PROFILE_FIELDS, MOTIVATION_LENGTH, SAMPLE_LENGTH } from "@/libs/publish-application";
import { getClientIp } from "@/libs/client-ip";
import { ipRecord } from "@/libs/geoip";

export const POST = withApiGuard(async (request, { session }) => {
    try {
        const body = await request.json().catch(() => null);
        const motivation = typeof body?.motivation === "string" ? body.motivation.trim() : "";
        const writingSample = typeof body?.writingSample === "string" ? body.writingSample.trim() : "";
        if (motivation.length < MOTIVATION_LENGTH.min || motivation.length > MOTIVATION_LENGTH.max) {
            return NextResponse.json({ data: null, message: `Tell us why you want to write in ${MOTIVATION_LENGTH.min} to ${MOTIVATION_LENGTH.max} characters` }, { status: 400 });
        }
        if (writingSample.length < SAMPLE_LENGTH.min || writingSample.length > SAMPLE_LENGTH.max) {
            return NextResponse.json({ data: null, message: `The writing sample needs ${SAMPLE_LENGTH.min} to ${SAMPLE_LENGTH.max} characters` }, { status: 400 });
        }
        const profile = parseProfileInput(body, APPLICATION_PROFILE_FIELDS);
        if (!profile.ok) {
            return NextResponse.json({ data: null, message: profile.message }, { status: 400 });
        }

        const user = await User.findById(session.user.id).select("role");
        if (!user || hasRole(user.role, ROLES.AUTHOR)) {
            return NextResponse.json({ data: null, message: "Only Readers can request to publish" }, { status: 400 });
        }

        const existing = await PublishRequest.findOne({ userId: session.user.id, status: "Pending" });
        if (existing) {
            return NextResponse.json({ data: null, message: "You already have a pending request" }, { status: 400 });
        }

        // Saved before the request exists, so a failure here can be retried without "already pending".
        await saveProfileFields(session.user.id, profile.set);
        const publishRequest = await PublishRequest.create({ userId: session.user.id, motivation, writingSample }).catch((error) => {
            // Two clicks racing past the check above: the unique index on pending requests rejects the second.
            if (error?.code === 11000) return null;
            throw error;
        });
        if (!publishRequest) {
            return NextResponse.json({ data: null, message: "You already have a pending request" }, { status: 400 });
        }
        const ip = getClientIp(request);
        after(async () => {
            try {
                await PublishRequest.updateOne({ _id: publishRequest._id }, { $set: { requestedFrom: await ipRecord(ip) } });
            } catch (error) {
                logger.warn("Failed to record the request's address", { error });
            }
        });
        // Only admins can review requests (PATCH /api/publish-requests/[id]), so only they are told.
        after(async () => {
            try {
                const admins = await User.find({ role: ROLES.ADMIN }).select("_id").lean();
                await Promise.all(admins.map((admin) =>
                    notify({
                        recipientId: admin._id.toString(),
                        actorId: session.user.id,
                        actorUsername: session.user.username,
                        type: "publish_request",
                    })
                ));
                // An admin may have reviewed the request before these notifications existed.
                const current = await PublishRequest.findById(publishRequest._id).select("status").lean<{ status: string }>();
                if (current && current.status !== "Pending") await markRequestNotificationsRead(session.user.id);
            } catch (error) {
                logger.error("Failed to notify admins of a publish request", { error });
            }
        });
        return NextResponse.json({ data: { id: publishRequest._id.toString() }, message: "Success" });
    } catch (error) {
        logger.error("Failed to create publish request", { error });
        return NextResponse.json({ data: null, message: "Something went wrong" }, { status: 500 });
    }
});

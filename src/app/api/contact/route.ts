import { after, NextResponse } from "next/server";
import ContactMessage from "@/models/ContactMessage";
import User from "@/models/User";
import { getSession, withApiGuard } from "@/libs/api-guard";
import { getClientIp } from "@/libs/client-ip";
import { newContactReference, parseContactInput } from "@/libs/contact";
import { sendContactAcknowledgement, sendContactToOperator } from "@/libs/contact-emails";
import { logger } from "@/libs/logger";
import { notify } from "@/libs/notify";
import { ROLES } from "@/libs/roles";

// Anyone may write, signed in or not; the per-address limit keeps the form from mailing an inbox to death.
export const POST = withApiGuard(
    async (request) => {
        try {
            const body = await request.json().catch(() => null);
            // A field people never see, named so autofill leaves it alone: bots that fill every input get a normal-looking answer and nothing is stored.
            if (body && typeof body === "object" && typeof body.leave_empty === "string" && body.leave_empty.trim()) {
                return NextResponse.json({ data: { reference: newContactReference() }, message: "Success" });
            }
            const parsed = parseContactInput(body);
            if (!parsed.ok) return NextResponse.json({ data: null, message: parsed.message }, { status: 400 });

            const session = await getSession();
            const userId = session?.user?.id ?? null;
            const reference = newContactReference();
            await ContactMessage.create({ ...parsed.value, reference, userId, ip: getClientIp(request) });

            after(async () => {
                await sendContactToOperator({ ...parsed.value, reference, username: session?.user?.username ?? null });
                await sendContactAcknowledgement({ ...parsed.value, reference });
                try {
                    const admins = await User.find({ role: ROLES.ADMIN }).select("_id").lean();
                    await Promise.all(admins.map((admin) => notify({ recipientId: admin._id.toString(), actorId: userId, actorUsername: session?.user?.username ?? null, type: "contact_message" })));
                } catch (error) {
                    logger.error("Failed to notify admins of a contact message", { error });
                }
            });
            return NextResponse.json({ data: { reference }, message: "Success" });
        } catch (error) {
            logger.error("Failed to save a contact message", { error });
            return NextResponse.json({ data: null, message: "Couldn't send your message. Please try again." }, { status: 500 });
        }
    },
    { auth: false, rateLimit: { points: 5, duration: 60 * 60 } }
);

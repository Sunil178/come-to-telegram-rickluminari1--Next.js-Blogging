"use server";

import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { forgetVisitor } from "@/libs/visitor-events";
import { SITE_URL } from "@/libs/site-url";
import { COOKIE_MAX_AGE_SECONDS, CONSENT_COOKIE, consentedVisitorId, isVisitorId, VISITOR_COOKIE, type ConsentChoice } from "@/libs/visitor";

export async function setConsentAction(choice: ConsentChoice): Promise<void> {
    if (choice !== "granted" && choice !== "denied") return;
    const jar = await cookies();
    const options = { maxAge: COOKIE_MAX_AGE_SECONDS, httpOnly: true, sameSite: "lax" as const, path: "/", secure: SITE_URL.startsWith("https://") };

    if (choice === "granted") {
        if (!isVisitorId(jar.get(VISITOR_COOKIE)?.value)) jar.set(VISITOR_COOKIE, randomUUID(), options);
    } else {
        const visitorId = consentedVisitorId(jar);
        if (visitorId) await forgetVisitor(visitorId);
        jar.delete(VISITOR_COOKIE);
    }
    jar.set(CONSENT_COOKIE, choice, options);
}

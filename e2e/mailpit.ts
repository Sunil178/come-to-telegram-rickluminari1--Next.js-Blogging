import { expect, type APIRequestContext } from "@playwright/test";

// Mailpit catches the app's SMTP traffic during e2e runs (docker compose --profile mail up -d mailpit).
export const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? "http://127.0.0.1:8025";

interface MailpitSummary {
    ID: string;
    Subject: string;
}

export async function messagesTo(request: APIRequestContext, address: string): Promise<MailpitSummary[]> {
    const response = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${address}"` } });
    expect(response.ok(), `Mailpit isn't reachable at ${MAILPIT_URL}`).toBe(true);
    return (await response.json()).messages ?? [];
}

// Waits for the newest email to `address` whose subject matches, and returns the first app link in it.
export async function linkFromLatestEmail(request: APIRequestContext, address: string, subject: RegExp, minCount = 1): Promise<string> {
    let latest: MailpitSummary | undefined;
    await expect.poll(async () => {
        const matching = (await messagesTo(request, address)).filter((message) => subject.test(message.Subject));
        latest = matching[0];
        return matching.length;
    }, { timeout: 10_000 }).toBeGreaterThanOrEqual(minCount);

    const message = await (await request.get(`${MAILPIT_URL}/api/v1/message/${latest!.ID}`)).json();
    const link = (message.Text as string).match(/https?:\/\/\S+\/auth\/\S+/)?.[0];
    expect(link, "email contains an app link").toBeTruthy();
    return new URL(link!).pathname + new URL(link!).search;
}

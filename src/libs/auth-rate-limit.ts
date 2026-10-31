import { RateLimiterMemory } from "rate-limiter-flexible";
import { consumePoint, ipKey } from "@/libs/rate-limit";

// In-memory, like withApiGuard's limiter: per process, reset on restart (see DOC-06).
const LOGIN_WINDOW_SECONDS = 15 * 60;
// Stops credential stuffing from one IP across many accounts.
const loginByIp = new RateLimiterMemory({ points: 20, duration: LOGIN_WINDOW_SECONDS });
// Stops guessing one account from one IP.
const loginByAccountAndIp = new RateLimiterMemory({ points: 5, duration: LOGIN_WINDOW_SECONDS });
// Stops a guessing run spread across many IPs. IPs that have signed into the account before skip it,
// so an attacker exhausting it can't lock the owner out of their usual network (OWASP's lockout compromise).
const loginByAccount = new RateLimiterMemory({ points: 50, duration: 60 * 60 });
// The memory store expires keys with setTimeout, whose 32-bit limit (~24.8 days) turns longer durations into 1 ms.
const TRUSTED_IP_SECONDS = 24 * 24 * 60 * 60;
const trustedAccountIps = new RateLimiterMemory({ points: 1, duration: TRUSTED_IP_SECONDS });
const registrationsByIp = new RateLimiterMemory({ points: 10, duration: 60 * 60 });

const accountKey = (account: string) => account.trim().toLowerCase();

// Reserves the attempt before the password is checked, so concurrent guesses can't all slip
// past the limit while bcrypt runs; recordLoginSuccess() refunds it.
export async function beginLoginAttempt(ip: string, account: string): Promise<boolean> {
    const key = accountKey(account);
    const ipBucket = ipKey(ip);
    if (!(await consumePoint(loginByIp, ipBucket))) return false;
    if (!(await consumePoint(loginByAccountAndIp, `${key}|${ipBucket}`))) return false;
    if (await trustedAccountIps.get(`${key}|${ipBucket}`)) return true;
    return consumePoint(loginByAccount, key);
}

export async function recordLoginSuccess(ip: string, account: string): Promise<void> {
    const key = accountKey(account);
    const ipBucket = ipKey(ip);
    await Promise.all([
        loginByIp.reward(ipBucket, 1),
        loginByAccountAndIp.delete(`${key}|${ipBucket}`),
        loginByAccount.reward(key, 1),
        trustedAccountIps.set(`${key}|${ipBucket}`, 1, TRUSTED_IP_SECONDS),
    ]);
}

export function consumeRegistrationAttempt(ip: string): Promise<boolean> {
    return consumePoint(registrationsByIp, ipKey(ip));
}

import { RateLimiterMemory } from "rate-limiter-flexible";

// In-memory, like withApiGuard's limiter: per process, reset on restart (see DOC-06).
const LOGIN_WINDOW_SECONDS = 15 * 60;
// Stops credential stuffing from one IP across many accounts.
const loginByIp = new RateLimiterMemory({ points: 20, duration: LOGIN_WINDOW_SECONDS });
// Stops guessing one account from one IP, without letting an attacker lock the owner out everywhere.
const loginByAccountAndIp = new RateLimiterMemory({ points: 5, duration: LOGIN_WINDOW_SECONDS });
// Looser cap that still stops a guessing run spread across many IPs (OWASP's lockout compromise).
const loginByAccount = new RateLimiterMemory({ points: 50, duration: 60 * 60 });
const registrationsByIp = new RateLimiterMemory({ points: 10, duration: 60 * 60 });

const accountKey = (account: string) => account.trim().toLowerCase();

async function consume(limiter: RateLimiterMemory, key: string): Promise<boolean> {
    try {
        await limiter.consume(key);
        return true;
    } catch {
        return false;
    }
}

// Reserves the attempt before the password is checked, so concurrent guesses can't all slip
// past the limit while bcrypt runs; recordLoginSuccess() refunds it.
export async function beginLoginAttempt(ip: string, account: string): Promise<boolean> {
    const key = accountKey(account);
    return (
        (await consume(loginByIp, ip)) &&
        (await consume(loginByAccountAndIp, `${key}|${ip}`)) &&
        (await consume(loginByAccount, key))
    );
}

export async function recordLoginSuccess(ip: string, account: string): Promise<void> {
    const key = accountKey(account);
    await Promise.all([loginByIp.reward(ip, 1), loginByAccountAndIp.delete(`${key}|${ip}`), loginByAccount.reward(key, 1)]);
}

export function consumeRegistrationAttempt(ip: string): Promise<boolean> {
    return consume(registrationsByIp, ip);
}

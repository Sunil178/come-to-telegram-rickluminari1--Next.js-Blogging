# Accounts

**Who:** visitors and every signed-in role. **Entry points:** "Login" and "Register" in the navbar, `/auth/login?callbackUrl=…` redirects from gated pages and gated actions, verification and reset links in emails.

## How it works

Auth.js v5 with a credentials provider and JWT sessions (`src/app/api/auth/[...nextauth]/auth.ts`, `src/auth.config.ts`). Registration is a server action (`src/actions/register.ts`); verification and reset use one-time hashed tokens (`src/libs/auth-tokens.ts`) mailed through SMTP (`src/libs/mailer.ts`), and both features are off without `SMTP_HOST`. Sign-in attempts are rate limited per address, per account and address, and per account (`src/libs/auth-rate-limit.ts`). A session is re-checked against the database at most every 60 seconds, so a password change, reset or account deletion signs other browsers out within a minute.

## Flows

### 1. Register and verify the email

**Preconditions:** logged out; SMTP configured.

1. Opens `/auth/register`, enters username, email and a password of at least 8 characters. → "Check your email" message.
2. Opens the emailed link. → The email is confirmed and they can sign in.

**Extensions:**

- 1a. Username or email already taken, or the password too short: the form says which field to fix.
- 1b. Without SMTP: the account is usable at once (no verification step).
- 2a. The link is used twice or after 24 hours: it no longer works; signing in offers to send a new one.

**Side effects:** user record (role reader), sign-up address and approximate location recorded after the response; verification email.

**Tested by:** `e2e/accounts.spec.ts` › "a new account confirms its email before it can sign in"; `e2e/account.spec.ts` › "registration asks for at least 8 characters".

### 2. Sign in and out

**Preconditions:** an account.

1. Opens `/auth/login` (or is sent there from a gated page), enters email and password. → Lands on the page they came from (`callbackUrl`), or `/posts`.
2. Chooses "Logout" in the avatar menu. → Signed out; push is unsubscribed in this browser and editor drafts are cleared.

**Extensions:**

- 1a. Wrong password: "Invalid email or password. Please try again.", the same for an unknown email.
- 1b. Unverified email (with SMTP): sign-in is refused with an offer to resend the link.
- 1c. Too many attempts: "Too many sign-in attempts. Please try again later."; it clears when the window passes.

**Side effects:** last sign-in address and location recorded after the response; consented reading history is attached to the account.

**Tested by:** `e2e/auth.spec.ts` › "a wrong password is rejected with a clear message", "gated pages redirect a logged-out visitor to login and back".

### 3. Forgot and reset password

**Preconditions:** SMTP configured.

1. Opens "Forgot password?", enters an email. → The same confirmation whether or not an account exists.
2. Opens the emailed link, sets a new password. → Can sign in with it; every other browser is signed out.

**Extensions:**

- 1a. Unknown email: the same message, and nothing is sent.
- 2a. Link reused or older than 1 hour: refused, with a way to ask again.

**Side effects:** reset email; `passwordChangedAt` set, which ends other sessions at their next check.

**Tested by:** `e2e/accounts.spec.ts` › "a forgotten password is reset through a one-time emailed link", "a reset request for an unknown email looks the same and sends nothing", "a password reset signs the account out of its other browsers".

## Rules and limits

- Passwords: at least 8 characters (`src/libs/password-policy.ts`).
- Sign-in: 20 attempts per address and 5 per account and address in 15 minutes, 50 per account in an hour. Addresses that signed into the account in the last 24 days skip the account-wide limit, so an attacker can't lock the owner out of their usual network. The same exemption applies to the account-wide email limit.
- Registration: 10 per address per hour. Verification and reset emails: 3 per account and address, 10 per address, 10 per account, each per hour.
- Verification links last 24 hours, reset links 1 hour; both work once.
- Gated pages (`/posts/add`, `/posts/:slug/edit`, `/posts/:slug/revisions`, `/dashboard/**`) redirect to sign-in before rendering (`src/proxy.ts`, `src/libs/route-gates.ts`).

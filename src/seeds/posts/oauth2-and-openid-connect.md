---
title: "Understanding OAuth 2.0 and OpenID Connect"
titleDescription: "Two related protocols that get confused constantly, doing two different jobs"
categorySlug: "technology"
tags: ["Security", "OAuth", "Authentication"]
bannerImage: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b"
summary: "OAuth 2.0 is about authorization — granting access to resources. OpenID Connect adds authentication — proving who you are. Conflating them causes real bugs."
published: true
publishedAt: "2026-06-03"
approval: "Approved"
approvedAt: "2026-06-04"
visitorCount: 1690
---

"Sign in with Google" buttons are so common that most developers treat OAuth as if it were a login protocol. It isn't, strictly — OAuth 2.0 was designed for **authorization**: letting an application access a resource on your behalf (your Google Calendar, your GitHub repos) without ever handing that application your password. Authentication — proving who you are — is a related but separate concern, handled by **OpenID Connect (OIDC)**, a thin identity layer built on top of OAuth 2.0. Knowing the difference matters, because "OAuth login" that skips OIDC is a common source of real security bugs.

## The roles in an OAuth flow

- **Resource Owner** — the user, who owns the data being accessed.
- **Client** — the application requesting access (your app).
- **Authorization Server** — issues tokens after the user consents (e.g. Google's, GitHub's).
- **Resource Server** — hosts the actual protected data (e.g. Google Calendar's API).

## The Authorization Code flow, the one you should actually use

```
1. User clicks "Sign in with Google" in your app
2. Your app redirects to Google's authorization endpoint, with a `redirect_uri`
3. User logs into Google, consents to the requested scopes
4. Google redirects back to your `redirect_uri` with a one-time `code`
5. Your SERVER exchanges that `code` (+ a client secret) for an access token
6. Your server uses the access token to call the Resource Server on the user's behalf
```

The critical detail in step 5: the code-for-token exchange happens **server-to-server**, using a client secret that never reaches the browser. This is precisely why the Authorization Code flow is the recommended approach for a traditional web app with a backend — the access token itself never transits through the user's browser, where it would be exposed to anything running on that page.

```ts
// Server-side token exchange — the client secret never leaves the server
const response = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code: authorizationCode,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: "https://yourapp.com/auth/callback",
    grant_type: "authorization_code",
  }),
});
const { access_token, id_token } = await response.json();
```

## Where OpenID Connect comes in

Notice the response above includes both an `access_token` and an `id_token` — this is OIDC's contribution. OAuth 2.0 alone only promises "here's a token that can access some resource"; it says nothing verifiable about *who* the user is. OIDC adds the `id_token`, a signed **JWT** containing verified identity claims:

```json
{
  "sub": "10769150350006150715113082367",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Jane Doe",
  "iss": "https://accounts.google.com",
  "aud": "your-client-id",
  "exp": 1735689600
}
```

`sub` (subject) is the stable, unique identifier for this user at this identity provider — the field you should actually key your own user records on, not the email address, which a user could theoretically change at the provider.

## Why using a raw access token for login is a real mistake

Before OIDC existed, some apps tried to use OAuth's access token itself as proof of identity — call the API, get back "yes, this token works," and treat that as "the user is logged in." The problem: an access token only proves the token is *valid for calling that specific API* — it says nothing that's been cryptographically signed and verified about who the person actually is, and different providers' access tokens have wildly inconsistent structure and guarantees. The `id_token`'s signature, issuer, audience, and expiry are all things your server can and should verify independently before trusting any claim inside it.

## Scopes: the actual authorization boundary

```
scope=openid email profile
```

`openid` triggers the OIDC identity layer itself (without it, you get plain OAuth — access, but no verified identity). `email` and `profile` request specific pieces of information the user has to consent to sharing. The principle worth internalizing: request the narrowest set of scopes your app actually needs. A blog that only needs to know a user's email and name has no reason to request calendar or file-storage access, even if the provider offers it — every additional scope is both a larger consent prompt (which erodes user trust) and a larger blast radius if your app's tokens are ever compromised.

## PKCE: closing the gap for public clients

Mobile and single-page apps can't safely hold a client secret (it would ship inside the app bundle, readable by anyone). **PKCE** (Proof Key for Code Exchange) replaces the secret with a dynamically generated, per-request cryptographic challenge, so even a public client without a stored secret can use the Authorization Code flow safely. Modern OAuth guidance recommends PKCE for essentially every client type now, not just mobile apps — it costs little and closes off a class of interception attacks on the authorization code itself.

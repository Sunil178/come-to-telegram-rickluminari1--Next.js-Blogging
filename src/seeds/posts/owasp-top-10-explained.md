---
title: "Web Security Essentials: The OWASP Top 10 Explained"
titleDescription: "The most common ways web applications actually get broken into"
categorySlug: "technology"
tags: ["Security", "Web Development", "OWASP"]
bannerImage: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43"
summary: "A practical walkthrough of the vulnerability classes that show up again and again — with the fix, not just the definition."
published: true
publishedAt: "2026-05-27"
approval: "Approved"
approvedAt: "2026-05-28"
visitorCount: 2260
---

The OWASP Top 10 is a periodically updated ranking, maintained by the Open Worldwide Application Security Project, of the most critical web application security risks — compiled from real vulnerability data, not theoretical concern. It isn't a checklist you satisfy once; it's a description of the mistakes that keep recurring across totally unrelated codebases, which is exactly why it's worth understanding the pattern behind each one, not just memorizing the name.

> "Security is a process, not a product." — Bruce Schneier

## Injection

Untrusted input gets concatenated directly into a command interpreter — a SQL query, a shell command, an ORM query — letting an attacker change what that command actually does:

```ts
// ❌ user input concatenated directly into a query string
const posts = await db.query(`SELECT * FROM posts WHERE slug = '${req.query.slug}'`);
// slug = "' OR '1'='1" returns every row in the table

// ✅ parameterized query — the value is never interpreted as SQL syntax
const posts = await db.query("SELECT * FROM posts WHERE slug = ?", [req.query.slug]);
```

The fix is never "sanitize the input harder" as the primary defense — it's using an API that treats the value as *data*, never as executable syntax, in the first place. Parameterized queries and ORMs that build queries programmatically (rather than through string interpolation) close this off structurally.

## Broken authentication

Weak password policies, session tokens that don't expire, or predictable session identifiers let an attacker impersonate a legitimate user. This is squarely why this codebase, for instance, never hand-rolls session logic — it relies on a maintained auth library, hashes passwords with a slow, salted algorithm (`bcrypt`, not plain SHA-256), and treats session tokens as bearer credentials that need the same care as a password.

## Sensitive data exposure

Storing passwords in plain text, transmitting credentials over unencrypted HTTP, or returning more data in an API response than the client actually needs — all variations of the same mistake: sensitive data existing somewhere it doesn't need to, or traveling somewhere it isn't protected.

```ts
// ❌ leaks the password hash to every client that fetches a user
const user = await User.findById(id);
return Response.json(user);

// ✅ only the fields the client actually needs
const user = await User.findById(id).select("username email avatar");
return Response.json(user);
```

## Broken access control

Authentication answers "who are you"; access control answers "what are you allowed to do" — and mixing them up is one of the most common real-world vulnerabilities. A logged-in user editing someone *else's* post by guessing their post ID (**IDOR** — Insecure Direct Object Reference) is a broken-access-control bug, not an authentication bug:

```ts
// ❌ any logged-in user can delete any post, if they know or guess the slug
await Post.findOneAndDelete({ slug: req.params.slug });

// ✅ the deletion is scoped to the requester's own post — ownership,
// not just login state, is the actual gate
await Post.findOneAndDelete({ slug: req.params.slug, userId: session.user.id });
```

## Security misconfiguration

Default credentials left unchanged, verbose error pages that leak stack traces and internal paths, unnecessary features or ports left enabled — none of these are exotic exploits, they're just things that were never turned off. This is the category best addressed by a checklist and a hardened default config, rather than clever code, because the fix is usually "disable the thing," not "write a defense."

## Cross-Site Scripting (XSS)

User-supplied content gets rendered as live HTML/JavaScript instead of inert text, letting an attacker's `<script>` tag execute in another user's browser session:

```ts
// ❌ dangerouslySetInnerHTML with unsanitized user content
<div dangerouslySetInnerHTML={{ __html: post.content }} />

// ✅ sanitize before ever rendering as HTML
import DOMPurify from "dompurify";
const clean = DOMPurify.sanitize(post.content);
<div dangerouslySetInnerHTML={{ __html: clean }} />
```

Any app that stores and later renders rich-text/HTML content — a blog, a comment section, a wiki — needs exactly this pattern: sanitize on the way out (or on the way in, but consistently one or the other), because the alternative is trusting every past and future piece of user-submitted content to never contain a script tag.

## Cross-Site Request Forgery (CSRF)

A malicious site tricks a logged-in user's browser into submitting a request to your app — the browser automatically attaches the user's session cookie, and your server, seeing a valid cookie, can't tell the request wasn't intentional. `SameSite=Lax` (or `Strict`) cookies, plus anti-CSRF tokens on state-changing requests, are the standard defenses.

## The pattern underneath all ten

Nearly every category above reduces to the same root cause: **trusting input, a client, or a piece of state that shouldn't be trusted without verification.** The specific defenses differ, but the discipline is consistent — validate at the boundary where untrusted data enters the system, and never assume a client is well-behaved just because your own frontend happens to be.

# Checklist — QA pass 1

A real-user QA pass over every flow group in `docs/flows/README.md`, following `docs/procedures/qa-testing.md`. One group per session; each group ends with its flow document written, its findings fixed or recorded as owner decisions, and its scenarios automated. The agent commits each milestone after tests, a code review and real-browser verification (D-13).

**Current focus:** QA-M3

Legend: `[ ]` pending · `[~]` done, uncommitted · `[x]` committed

## Owner-reported findings (2026-11-02)

- [x] QA-01 Clearing the posts search kept the filtered list: the search box remounted on every result (`key={q}`) and its mount effect re-sent stale queries, also losing focus. It now keeps its own state and adopts only URL changes it didn't make (a nav link, back button); its own results arriving late never overwrite newer typing. It replaces the history entry instead of pushing one per pause, so Back leaves the posts page rather than stepping through partial queries. Same fix on the dashboard posts table.
- [x] QA-02 "Request to publish" was offered again after a reload although a request was pending: the page now passes the latest request's status (pending → message, rejected → "Request again", approved in the last 5 minutes → "writing unlocks within a minute" while the session's role catches up). A unique partial index allows one pending request per user, so a double click can't create two. A database that already holds two pending requests for one user can't build that index (Mongoose only reports it through the model's `index` event); find them with `db.publishrequests.aggregate([{$match:{status:"Pending"}},{$group:{_id:"$userId",n:{$sum:1}}},{$match:{n:{$gt:1}}}])` and reject the extras.
- [x] QA-03 Bell entries showed an arrow cursor: shadcn's menu items use `cursor-default`; all dropdown menu items now use a pointer.
- [x] QA-04 An approved or rejected request stayed unread in every admin's bell: reviewing a request marks all admins' notifications of it read (`src/libs/publish-request-notifications.ts`, best effort, scoped to admins so it uses the `{ recipientId, read }` index). The request route re-checks the status after writing the notifications, so a review that lands before they exist still clears them.
- [x] QA-05 `/posts/add` showed the posts-grid skeleton (inherited `posts/loading.tsx`): the editor pages have an editor skeleton; revisions and every dashboard page have a neutral page skeleton instead of article cards.

- [x] QA-06 (found by the suite) The account-deletion test failed once: after the reload, the surviving reply matched twice, though the database holds it once and the tree builder is correct. The second match had no accessible role, consistent with a hidden streamed copy during the reload; the test now asserts exactly one visible copy. Verified: unit 317, tsc, lint (2 old warnings), chromium e2e 27 passed + 1 push skip; the new search test fails on the old code exactly as reported.

## Owner decisions (2026-11-02)

- [x] QA-D2 Production keeps starting without SMTP; email verification stays off when `SMTP_HOST` is unset.
- [x] QA-D3 Store the sign-up and request IP addresses with an approximate location, shown to admins only, with no time-based deletion (account deletion still removes them, as the privacy policy promises). The project is pre-launch: schema changes need no backward compatibility.
- [x] QA-D4 Every feature gets automated coverage, including comment edit and delete, downvotes, author votes, categories admin, user and role management, and post rejection.
- [x] QA-D1 Profile and application: optional profile fields in the account section, public (photo, bio, country, city, website, social links, expertise, topics, education) and private to the user and admins (date of birth, gender, phone, address); an application form at request time, prefilled from and saved back to the profile, with motivation and writing sample kept on the request; an admin review page with profile, activity and IP.
- [x] QA-D5 Uploads: photo metadata kept in the database (author and admins only), GPS stripped from the served file; per-file size, daily count, per-author storage and a rate limit, each configurable from env.
- [x] QA-D6 Search: MongoDB text index for search and an indexed related-posts lookup.
- [x] QA-D7 The flow-documentation and QA method become a standalone kit that can be copied into other projects.
- [x] QA-D8 Unused uploads: an admin page lists files no post references, with download and delete, per file, selected or all.

## Milestones (one per session, in this order)

- [x] QA-M1 Automated coverage for every untested feature, fixing what it finds. New specs: `comments`, `votes`, `admin`, `moderation`, `reading`. Findings fixed:
  - QA-07 Authors couldn't file a post under a category (the editor had no field), so category filters were always empty: the editor has a category select, validated against visible categories; post pages link to their category.
  - QA-08 A rejected post stayed rejected forever: the author's save now sends it back to Pending.
  - QA-09 Moderators were never told a post was waiting: new and resubmitted posts notify every moderator and admin (`post_submitted`, own preference switch "Posts waiting for review"); reviewing marks those notifications read.
  - QA-10 Rejections had no explanation: moderators can give a reason (up to 1000 characters), shown on the edit page; the notification links there.
  - QA-11 Deleting a category and removing a comment in admin happened on one click: both ask first (`ConfirmIconButton`).
  - QA-12 Admin comments showed only the latest 20 and users had no search or paging: both have search and pagination.
  - QA-13 No page had a `<main>` landmark, and the footer (with the privacy link and cookie preferences) only appeared on the home page: the root layout wraps pages in `<main>` and renders the footer on every page.
  - QA-14 Signed-in users can't change their password without the emailed reset link (unavailable without SMTP): fixed in QA-M2: the account page has a change-password form.
  - Review (`/code-review high 846b70d`): 9 findings, all fixed: a deleted or hidden category no longer blocks saving a post; post-review notifications written after a fast review or a deletion are marked read; the resubmit banner shows only to the post's author; deleting a post clears its review notifications; admin paging sorts with an `_id` tiebreaker; repeated query parameters (`?q=a&q=b`) no longer crash list pages (`src/libs/search-params.ts`, shared page parsing); the post page links its category only when the posts page can filter by it; marking reviews read runs after the response.
- [x] QA-M2 Profiles, application form, admin review page, IP and location, change password (QA-14). New spec `profile`; geolocation verified for real (8.8.8.8 → Mountain View, California, United States) with the downloaded DB-IP City Lite database.
  - Account page: photo upload and removal, public profile (headline, bio, country, city, website, links, expertise, topics, education), private details (date of birth with a 13+ check, gender, phone, address), change password (current password checked, signs every session out). Author pages show the public profile; private details never leave the account and admin pages.
  - Request to publish opens an application form (motivation and writing sample kept on the request; headline, bio, website, links, expertise and topics prefilled from and saved back to the profile).
  - Admin review page `/dashboard/admin/requests/[id]`: application, account and activity (age, verification, comments and votes, earlier requests), addresses with location (sign-up, last sign-in, request), public profile and private details, with approve and reject; the list links to it and shows where each request came from.
  - IP and location recorded at sign-up, sign-in and request (`src/libs/geoip.ts`, `maxmind` reader over `GEOIP_DB_PATH`, `npm run geoip:download`), kept without expiry, removed with the account; privacy page and DB-IP attribution updated; included in the data export.
  - Review (`/code-review high b136878`): 10 findings, all fixed: accounts with an old plain-string `profile` can save the new profile; the application's profile write happens before the request exists; seed users carry structured profiles; replaced and removed photos (and a deleted account's photo) are deleted from disk once unused; changing the password also drops push and drafts like logging out; the geolocation file reloads after the monthly download; `data/geoip` ships in the repository so Docker doesn't create it as root; password change validates with the shared `PASSWORD_RULE`; duplicate links are dropped; list parsing lives only on the server.
- [ ] QA-M3 Uploads: private metadata, GPS stripped, limits, unused-uploads admin page
- [ ] QA-M4 Search text index and related-posts lookup
- [ ] QA-M5 Reusable flow-doc and QA kit, and flow documents per group

## Flow groups

- [ ] Accounts
- [ ] Account self-service
- [ ] Reading
- [ ] Writing
- [ ] Moderation
- [ ] Comments
- [ ] Votes
- [ ] Publish requests
- [ ] Notifications
- [ ] Administration
- [ ] Privacy and consent
- [ ] Platform
- [ ] Final multi-browser run and pass report

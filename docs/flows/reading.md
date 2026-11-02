# Reading

**Who:** everyone, logged out included. **Entry points:** the home page, "Posts" in the navbar, category chips, search, author links, RSS readers and search engines (feed, sitemap).

## How it works

Readers only ever see public posts: approved, published, visible and past their publish time (`publicPostFilter()` in `src/libs/post-visibility.ts`). The posts list (`src/app/posts/page.tsx`) filters by category and searches through `src/libs/post-search.ts`: a weighted MongoDB text index over title, tags, description and summary, stemmed and ranked by relevance, with a title fallback for half-typed words. The post page (`src/app/posts/[slug]/page.tsx`) adds the table of contents, reading time, votes, comments and up to three related posts (`src/libs/related-posts.ts`). Views are counted once per visitor address per 30 minutes (`src/app/api/posts/[slug]/view/route.ts`).

## Flows

### 1. Browse and page through posts

1. Opens `/posts`. → The newest public posts, 9 per page, with the total count.
2. Chooses a category chip. → Only that category's posts; the chip stays selected.
3. Chooses "Next" and "Previous". → The next and previous pages, keeping the category and search.

**Extensions:**

- 1a. A page number that isn't a positive number: the first page. A page past the end: "No articles found." with pagination back.

**Tested by:** `e2e/reading.spec.ts` › "the posts list pages through more than one page of posts".

### 2. Search posts

1. Types in "Search articles". → After a short pause the URL gets `?q=` and the list shows matching posts, best match first: words in the title rank above tags, tags above the description.
2. Clears the box, in one go or a few characters at a time. → Every post comes back, and the box keeps the text and focus throughout.

**Extensions:**

- 1a. A half-typed word ("welc"): titles containing it as typed.
- 1b. A plural or other form ("databases"): stemmed, so "database" matches.
- 1c. No match: "No articles found."
- 2a. The navbar's "Posts" link: empties the box and shows every post.

**Tested by:** `e2e/content.spec.ts` › "clearing the posts search brings every post back, even when cleared in pauses"; `e2e/reading.spec.ts` › "search ranks title matches above tag and description matches, and a half-typed word still finds titles".

### 3. Read a post

1. Opens a post. → Banner, title, author, date, reading time, table of contents, body, votes, comments and related posts.
2. Reloads. → The visitor count went up once, not again.

**Extensions:**

- 1a. An unknown slug or a deleted post: the not-found page. A post that isn't public (pending, rejected, hidden, scheduled): the not-found page for readers; its author and moderators and admins can still open it.
- 1b. Related posts: shared tags first, then the same category, then newest; deleted and non-public posts never appear.

**Tested by:** `e2e/content.spec.ts` › "a post lists related posts that share its tags"; `e2e/reading.spec.ts` › "unknown, deleted and non-public posts show readers the not-found page", "related posts put shared tags before the same category, and never show a deleted post", "a post's visitor count goes up once per visitor address, not on every reload".

### 4. Visit an author's profile

1. Chooses an author's name. → `/users/<username>` with photo, public profile (headline, location, bio, expertise, topics, links), profile votes and their published posts only.

**Tested by:** `e2e/reading.spec.ts` › "an author's profile lists their published posts only"; `e2e/profile.spec.ts` › "a user fills in their profile; the public part shows on their author page and the private part doesn't".

### 5. Feeds for machines

1. A feed reader fetches `/feed.xml`; a search engine fetches `/sitemap.xml` and `/robots.txt`. → Public posts only; robots.txt disallows `/dashboard`, `/auth/` and `/api/`.

**Tested by:** `e2e/reading.spec.ts` › "the RSS feed, sitemap and robots.txt list public posts and nothing private".

## Rules and limits

- Posts list: 9 per page; search queries are cut to 200 characters at a word boundary.
- Views: one per visitor address per 30 minutes (only a hash of the address is kept, for 30 minutes); the view endpoint allows 20 requests a minute per address (`VIEW_RATE_LIMIT_POINTS`, `VIEW_RATE_LIMIT_DURATION_SECONDS`).
- RSS feed: 30 requests a minute per address.
- Profile links carry `rel="ugc nofollow"`.

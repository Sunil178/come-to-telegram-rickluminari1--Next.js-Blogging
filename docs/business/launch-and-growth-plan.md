# Vedev.Guru: launch and growth plan (India)

Research for taking Vedev.Guru public from Kalwa, Thane, Maharashtra: the name, the legal and tax position in India, what to do in which order, how the blog earns money, and how one codebase becomes several niche sites. A visual version of this document is [launch-and-growth-plan.html](launch-and-growth-plan.html).

- **Researched:** 2026-11-03; name and domain checks 2026-11-04. Laws, fees and rates change, so re-check anything marked *verify* before acting on it.
- **Not legal or tax advice.** Use this as a checklist to discuss with a trademark attorney and a chartered accountant (CA). One hour with each before monetizing is worth it.
- **Assumptions:**
  - You publish alone at first, as an individual (sole proprietor), from home, with no employees.
  - Readers are worldwide and the posts are in English.
  - The niche is developer and technology content.
  - USD amounts are converted at about ₹88 per US$.

Evidence labels:
- **Code:** checked in this repository.
- **Official:** a government or Google page.
- **Secondary:** law-firm, accountant or industry articles.
- **Estimate:** my own judgement.

## 1. Summary

- **You can go public without a trademark.** In India a trademark protects a name you use; it isn't a licence to use it. The real launch blocker is making sure nobody else already owns the name: a search of the IP India trademark records costs nothing and takes about an hour.
- **Choose a new name before launch.** "VEDEV" is already taken as a trademark and `vedev.com` and `vedev.in` belong to others. **LekhLab** is the recommended replacement: every domain ending is free and no conflicting trademark record turned up (section 2). Run the official IP India search on it before buying.
- **What actually blocks launch:**
  1. The new name, the official name search and the domains.
  2. The operator details for the legal pages (`OPERATOR_NAME`, `OPERATOR_LOCATION`, `CONTACT_EMAIL`), and a lawyer's read of them before monetizing. The pages themselves are built: `/terms`, `/about`, `/contact` with the grievance officer, and an India-specific `/privacy`.
  3. Choosing whether strangers can sign up and comment: `SIGNUP_ENABLED` and `COMMENTS_ENABLED` switch each one off. Closed is recommended at launch.
  4. The deployment items in [docs/deployment-checklist.md](../deployment-checklist.md).

  Private posts are built too: they are owner-only and their images are private (section 10).
- **Can wait:** trademark filing (do it in the first 1 to 3 months), ads (once you have about 20 to 30 good posts and steady traffic), GST (only near ₹20 lakh a year of revenue), multiple sites (once the first site has traction), and full compliance with India's data protection rules (most duties start around 13 May 2027, *verify*).
- **Money:**
  - Ads alone are small until traffic is large. An English tech blog with a global audience earns roughly ₹265 to ₹1,320 per 1,000 pageviews; a mostly Indian audience earns several times less.
  - Affiliate links, sponsorships, a newsletter and later paid posts usually earn more than ads (section 7).
- **Running cost:** about ₹1,000 to ₹2,500 a month for hosting and services. On top of that come the domain (₹2,300 to ₹5,800 a year), a one-time ₹4,500 per trademark class, and a CA for the annual return (section 8).

## 2. The name

### 2.1 Rename before launch

The owner found on 2026-11-04 that "VEDEV" is already taken as a trademark, and `vedev.com` and `vedev.in` are registered by others (registry lookups, 2026-11-04). **Recommendation: choose a new name now, before launch.**

- **Cost:** renaming before launch costs a domain and a settings change; after launch it also costs search rankings, links and readers' memory.
- **Risk:** in India the Registrar refuses a new mark that is identical or similar to an earlier one for related goods or services, and the earlier owner can sue for infringement if their class covers publishing and education (41) or software (9 and 42).
- **Growth:** the multi-site plan needs an umbrella name you can register and whose main domains you can own. With both domains gone, Vedev can't be that name.
- **If the existing VEDEV mark is in an unrelated class** (for example clothing) and you still want to keep the name, get a trademark attorney's clearance opinion first.
- **Keep `vedev.guru`** for a year or so and forward it to the new domain, so nothing already shared breaks.

### 2.2 How the names were checked

| Check | How | Limits |
|---|---|---|
| Domains | RDAP lookups straight to the registries on 2026-11-04: Verisign (`.com`), NIXI (`.in`), Identity Digital (`.guru`), Google Registry (`.dev`) and the `.blog` registry. "Free" means no registration exists. | A registry can still reserve a name or price it as premium; buy the chosen domains the same day. |
| Trademarks | Web searches for each exact name and its spelling variants, plus the trademark records that aggregators (registerkaro.in, trademarkdir.com, markinton.com) publish. | IP India's official search needs a captcha, and the aggregator's search blocks automated requests, so the register itself couldn't be queried. **Run the official IP India search yourself** (word mark and phonetic, classes 41, 35, 9, 42) before deciding. |
| Volume | About 60 candidate names. | Most short invented `.com` names are already registered (for example lekhly, bodhly, vidyora, gyanora, kalamly, inksutra, mindsutra, quillo). |

### 2.3 Shortlist

| Name | Meaning | `.com` | `.in` | `.blog` | `.dev` | `.guru` | Trademark (indexed records) | Fit |
|---|---|---|---|---|---|---|---|---|
| **LekhLab** | *lekh* (Hindi: article, writing) + lab | Free | Free | Free | Free | Free | No exact match. "LEKH" alone is used by a literary magazine and a notes app; different names. | **Recommended** |
| **Kalamverse** | *kalam* (pen) + verse | Free | Free | Free | Free | Free | No exact match. "Kalam" is also a term in Islamic theology and recalls Dr A. P. J. Abdul Kalam; KALAMANCH (class 41) exists. | Good |
| **Inkvedi** | ink + *vedi* (platform, stage) | Free | Free | Free | Free | Free | No match found. | Good, unusual |
| Lekhverse | *lekh* + verse | Free | Free | Free | Free | Free | No exact match; LETVERSE (US) is close in sound. | Fair |
| Notenagar | note + *nagar* (town) | Free | Free | Free | Free | Free | No match. In India "note" also means a currency note. | Fun, but the meaning can mislead |
| Shabdverse | *shabd* (word) + verse | Free | Free | Free | Free | Free | No match. | Hard to say outside India |
| Writesutra, Quillsutra | write/quill + *sutra* | Free | Free | Free | Free | Free | No match, but "sutra" is common in marks and the names describe the service, so protection is weak. | Weak |
| Vachaly, Lekhiq | coined | Free | Free | Free | Free | Free | No match. | Weak: unclear to readers |

### 2.4 Recommendation: LekhLab

- **Easy to read and say:** short (7 letters), it reads "writing lab" to Indian readers and is easy to say anywhere ("lekh-lab").
- **Fits every niche:** it suits tech posts and works as the network name for other niches ("Recipes by LekhLab").
- **Available:** every domain ending is free, and no indexed record conflicts with it.

Next steps, in order:
1. **Official IP India search** for LEKHLAB and LEKH LAB (word mark and phonetic) in classes 41, 35, 9 and 42.
2. **Buy domains:** `lekhlab.com` and `lekhlab.in` the same day (`.blog` optional).
3. **Claim social handles:** `@lekhlab`.
4. **File the trademark:** word mark LEKHLAB in class 41 as an individual (₹4,500).
5. **Rename the site:** change the name in the code through the brand settings (section 9.2).
6. **Forward the old domain:** point `vedev.guru` at the new one.

If LekhLab fails the official search, take Kalamverse, then Inkvedi, through the same steps.

## 3. Trademark in India

| Item | Detail | Evidence |
|---|---|---|
| Is registration required to launch? | No. Using an unregistered name is legal, and prior use is protected against copycats under the "passing off" rule. Registration makes enforcement much easier. | Secondary |
| The real risk | Someone else already owns a similar mark in a related class and forces a rebrand later. That's why the search is a launch blocker and the filing isn't. | Estimate |
| Where to search | IP India public search (tmrsearch.ipindia.gov.in). Search the chosen name and similar spellings (for LekhLab: LEKHLAB, LEKH LAB, LEKLAB) in classes 41, 35, 9 and 42, as word mark and phonetic. Also search MCA company names, the WIPO Global Brand Database, Google, app stores and social media. | Official (portal) |
| Classes | **41** (online publications, education, blogs): the one to file. **35** (advertising services): optional, for when you sell ad space or sponsorships. **9** (downloadable software) and **42** (software as a service): only if you later sell the platform. | Secondary |
| Government fee | ₹4,500 per class for an individual, startup or small enterprise filing online; ₹9,000 for companies and LLPs. Filing as an individual gets the lower fee without an Udyam registration. | Secondary, *verify on IP India* |
| Who files | You can file yourself at ipindiaonline.gov.in. An attorney or agent charges a fee on top and handles objections; get quotes. | Estimate |
| Timeline | Commonly 12 to 24 months to registration, including examination, any objection and opposition. Expedited examination costs ₹20,000 per class for individuals, which you can skip. | Secondary |
| Symbols | You can use ™ as soon as you file. Use ® only after registration; using it earlier is an offence. | Secondary |
| When to file | Within the first 1 to 3 months after launch, and before you put money into the brand: logo, merchandise, multiple sites, sponsorships. | Estimate |

## 4. Legal position in India

### 4.1 Laws that apply

| Law | Applies when | What it asks of the blog | When |
|---|---|---|---|
| **IT Act 2000 and the IT (Intermediary Guidelines) Rules 2021** | Other people can publish on the site (sign-up, comments). For your own posts you are the publisher and responsible for them. | Publish a privacy policy and terms that list prohibited content. Name a **grievance officer** (you) with contact details. Acknowledge complaints within 24 hours and resolve them within 15 days (*verify*; removal-type complaints have shorter limits). Remove content when ordered by a court or the government. | Now |
| **IT Amendment Rules 2026** | Same as above. | Orders to remove unlawful content must be acted on within **3 hours** (2 hours for non-consensual intimate images), effective 20 February 2026. **AI-generated images, audio and video** must carry a label; AI-written text isn't covered. | Now (Secondary, *verify*) |
| **Digital Personal Data Protection (DPDP) Act 2023 and Rules 2025** | You collect personal data in India: accounts, emails, IP addresses, comments. | A plain-language notice of what you collect and why; consent that is as easy to withdraw as to give; a contact for data requests; erasure when the purpose is over; breach notification. **Children are everyone under 18**: their data needs verifiable parental consent, and no tracking or targeted ads may be aimed at them. | Rules notified November 2025. Most duties apply from about **13 May 2027** (Secondary, *verify date*). Design for them now. |
| **Copyright Act 1957** | Always. | Use only images and text you own or have a licence for. If other people post, take infringing items down when notified (36 hours under the Copyright Rules, *verify*). | Now |
| **Consumer Protection Act and CCPA endorsement guidelines (2023)**, plus the ASCI code | You publish sponsored posts, affiliate links or reviews. | Clear disclosure ("Sponsored", "Affiliate link") placed where readers see it before the link, not hidden in the footer. | When you monetize this way |
| **Promotion and Regulation of Online Gaming Act 2025** | Any promotion. | Never advertise or accept sponsorship for real-money games or betting. In AdSense, block the gambling category for this site. | Always |
| **IT Rules 2021 Part III (Digital Media Ethics Code)** | You publish **news and current affairs**. | Extra duties apply to news publishers. Keep the niche to tutorials and analysis, or read this part before covering news. | Only if you do news |
| **GDPR (EU) and UK GDPR** | You serve readers in Europe or the UK, which an English blog will. | In practice: Google's consent rules for ads (section 6) and an honest privacy page. | When ads run |

### 4.2 Pages and policies the site needs

| Page or policy | Status (Code) | Needed for |
|---|---|---|
| Privacy policy | Built (`/privacy`): data fiduciary, purposes, children under 18, rights including nomination and the Data Protection Board, breaches, private posts. Still to add once ads run: an ads and cookies section. | Launch; ads (ad section) |
| Terms of use | Built (`/terms`): minimum age 18, the content the IT Rules prohibit, labelled AI media, review and removal, private posts, ads and affiliate disclosure, no professional advice, Indian law and courts at `OPERATOR_LOCATION`. | Launch |
| About page | Built (`/about`): who runs the site and from where, what it covers, how posts are made. | Launch, and AdSense review |
| Contact page | Built (`/contact`), with `CONTACT_EMAIL`. Use a mailbox on your own domain (a free Zoho Mail plan or a forwarder). | Launch, and AdSense review |
| Grievance officer and takedown notice | Built (on `/contact`): the operator as grievance officer, what a report must include (copyright too), and the response times. | Launch |
| Age 18+ and terms at sign-up | Built: a required checkbox; the account records when it was ticked (`termsAcceptedAt`). | Launch |
| Cookie and consent banner | Exists (`src/components/consent/ConsentBanner.tsx`) and covers your own visitor tracking. **It does not meet Google's ad-consent requirement** for Europe, the UK and Switzerland (section 6). | Ads |
| `ads.txt` | Missing. One line that names your AdSense publisher ID. | Ads |
| Disclosure policy | Missing. How sponsored and affiliate content is labelled. | Affiliate and sponsored posts |

### 4.3 Local registrations in Maharashtra

| Registration | Needed? | Evidence |
|---|---|---|
| Company or LLP | No. Start as an individual (sole proprietor). Consider a company only once revenue, risk or hiring justify it. | Estimate |
| Udyam (MSME) registration | Optional and free. Not needed for the lower trademark fee, since individuals already get it. | Secondary |
| Maharashtra Shops and Establishments | A home-based solo blogger with no premises or employees is generally not covered. Ask your CA. | Estimate, *verify* |
| Profession Tax (Maharashtra) | May apply to self-employed people above an income threshold (a small yearly amount). Ask your CA when income starts. | Estimate, *verify* |
| GST | Only once your total turnover approaches **₹20 lakh** a year. Ad income from Google Asia Pacific (Singapore), paid in foreign currency, is generally treated as an **export of services** (zero-rated), but it still counts toward the ₹20 lakh. | Secondary, *verify with CA* |

## 5. Tax on blog income

| Topic | Detail | Evidence |
|---|---|---|
| What the income is | Ad, affiliate and sponsorship income from a blog is business income, taxed at your slab rate. | Secondary |
| New law from April 2026 | The **Income-tax Act 2025** replaces the 1961 Act from 1 April 2026, and section numbers change. The 1961-Act numbers you'll see in older guides (44AD presumptive tax and so on) have new equivalents; ask your CA which form and scheme fit. | *verify with CA* |
| Presumptive scheme | Small businesses can usually declare a fixed share of turnover as profit (historically 6% for digital receipts) instead of keeping full accounts. It's often the simplest choice for a blog. | Secondary, *verify* |
| Advance tax | Payable in instalments if the year's tax due exceeds ₹10,000. | Secondary, *verify* |
| AdSense tax form (US) | AdSense asks every non-US publisher for a US tax form: **W-8BEN** for an individual, using your PAN. Earnings from content made outside the US are generally not subject to US withholding once the form is on file. The 24% and 15% withholding figures quoted in blogs are mainly about YouTube. Read the explanation in your AdSense account. | Secondary, *verify in AdSense* |
| Payments | Monthly bank transfer once your balance passes the payment threshold (about US$100, shown in your account currency). Your bank issues a foreign remittance advice (e-FIRA/FIRC) for each payment; keep them for tax and GST records. | Secondary, *verify in AdSense* |
| Keep records | Invoices or payment reports per source, bank statements, and expenses: hosting, domain, software, a share of internet costs, the trademark fee. | Estimate |

## 6. Ads: what AdSense and the code need

**Before you apply:**
- About 20 to 30 original, useful posts.
- Clear navigation, plus the About, Contact and Privacy pages (section 4.2).
- Real (even small) traffic.
- No copied or mass-produced AI content: Google rejects thin and low-value content, and its policy against content mass-produced to rank in search targets networks of quickly made sites.
- *Verify* the current requirements on the AdSense help pages.

**Consent for Europe, the UK and Switzerland:**
- To show personalized ads there, Google requires a **Google-certified consent tool that supports IAB TCF**. This has applied in the EEA and UK since 16 January 2024 and in Switzerland since 31 July 2024 (Official).
- Without one, those readers see only limited ads.
- **Recommendation:** AdSense's own "Privacy & messaging" consent message is a Google-certified option at no extra cost (*verify in your account*). Use it rather than a paid tool, and connect it to the site's existing consent choice so visitors answer once.

**What changes in the code** (agent work, when you decide to start ads):

| Change | Why | Where |
|---|---|---|
| Allow Google's ad domains in the security policy (CSP) | The CSP is `default-src 'self'` with nonce + `strict-dynamic` scripts and no `frame-src` or `connect-src` rules, so ad frames and ad requests would be blocked. | `src/libs/csp.ts` |
| Ad slot component, loaded only after consent and with the page's nonce | Ads must respect consent, and the strict CSP needs the nonce. | New component and the root layout |
| Ads on public post and list pages only | AdSense policy forbids ads on pages with no content, and ads must never run on private posts, the dashboard, login or the editor. | Post page, home page, posts list |
| `ads.txt` served from the root | Lets advertisers confirm you are the authorised seller; missing it lowers ad revenue. | `public/ads.txt` or a route |
| Privacy page section on ads | Required by AdSense and by DPDP-style notice rules. | `src/app/privacy/page.tsx` |
| Block sensitive categories | Gambling and betting (illegal to promote in India), plus anything that doesn't suit the brand. | AdSense settings (no code) |

**Account rules:**
- Never click your own ads or ask anyone to.
- One AdSense account per person; all your sites go into it.
- Invalid clicks get accounts closed permanently.

## 7. How the blog earns money, and how much

### 7.1 Ad income

Ad income ≈ monthly pageviews ÷ 1,000 × RPM (earnings per 1,000 pageviews). RPM depends on the niche and, most of all, on **where readers live**.

| Audience and niche | Typical page RPM | Evidence |
|---|---|---|
| US, UK and EU readers, tech or software niche | US$10 to $25 (about ₹880 to ₹2,200) at the top end; a new site usually earns much less | Secondary |
| Global English tech blog (mixed countries) | about US$3 to $15 (₹265 to ₹1,320) | Estimate |
| Mostly Indian readers, finance niche | ₹250 to ₹830 | Secondary |
| Mostly Indian readers, entertainment or general niche | ₹40 to ₹165 | Secondary |

| Monthly pageviews | Indian general readers (₹100 RPM) | Global tech, cautious (₹265) | Global tech, good (₹880) |
|---|---|---|---|
| 10,000 | ₹1,000 | ₹2,650 | ₹8,800 |
| 50,000 | ₹5,000 | ₹13,250 | ₹44,000 |
| 1,00,000 | ₹10,000 | ₹26,500 | ₹88,000 |
| 10,00,000 | ₹1,00,000 | ₹2,65,000 | ₹8,80,000 |

What this means in practice:
- **Traffic takes time:** a new blog usually needs 6 to 12 months of steady posting (about 2 to 3 good posts a week) before search traffic grows.
- **Write in English for a global audience** and pick topics people in high-RPM countries search for. That one choice can multiply income several times.
- **Risks:**
  - Google search updates move rankings.
  - AI answers in search results reduce clicks to blogs.
  - RPM swings from month to month: one 2026 report describes drops of 30% to 90% for small publishers (Secondary, single source).
  - Don't plan your life around ad income in year one.

### 7.2 Income sources ranked by fit for this blog

| Rank | Source | Why | When | India notes |
|---|---|---|---|---|
| 1 | **Affiliate links** (hosting, tools, courses, books, gadgets) | In tutorial and review niches this often beats ads. One good review post can earn more than thousands of ad views. | As soon as you have posts that recommend things | Amazon Associates India, hosting and SaaS affiliate programs. Disclose per CCPA and ASCI. |
| 2 | **Display ads** (AdSense, later premium networks) | Passive and grows with traffic. Premium networks pay more once you reach their traffic thresholds. | About 20 to 30 posts and steady traffic | W-8BEN, e-FIRA, GST counting (section 5) |
| 3 | **Sponsored posts and newsletter sponsorships** | Tech companies pay for reviews and tutorials once you have an audience. | A few thousand loyal readers | Label "Sponsored". Never real-money gaming or betting. |
| 4 | **Newsletter** | An email list you own doesn't depend on Google. The account email system already exists (`src/libs/mailer.ts`). | From launch: start collecting subscribers early | Needs consent and an unsubscribe link |
| 5 | **Members-only posts, courses, e-books, templates** | Your private-post feature can grow into paid posts for members. | After you've built trust and have a following | Needs a payment gateway (Razorpay or Cashfree); GST rules for selling digital products to Indian buyers apply. Ask your CA. |
| 6 | **Consulting or freelance work through the blog** | A tech blog works as a portfolio, and one client can be worth a year of ads. | Any time | Normal professional income |
| 7 | **Selling the platform** (multi-site hosting for other bloggers) | The multi-site setup (section 9) is already most of a product. | Much later, a separate business | Trademark classes 9 and 42; contracts, support, DPDP duties as a processor |

## 8. Running costs in India

| Item | Cost (approx.) | Notes |
|---|---|---|
| Server (2 vCPU, 4 GB, Docker Compose stack) | ₹600 to ₹2,200 a month | India regions: DigitalOcean Bangalore, AWS Lightsail Mumbai, Indian providers such as E2E Networks or Hostinger VPS. A 2 GB server can be enough at low traffic. A Mumbai or Bangalore server is fast for Indian readers; Cloudflare's CDN covers everyone else. |
| Domain `vedev.guru` | ₹2,300 to ₹5,800 a year | Renewal prices vary widely by registrar. Compare, and move to a registrar with fair renewal prices if yours is expensive. |
| Extra domains (`vedev.in` and others) | ₹700 to ₹1,500 a year each | Optional, for protection |
| Transactional email | ₹0 to ₹100 a month | Brevo's free plan or Amazon SES (Mumbai). Only needed once sign-up is open. |
| Contact inbox on your domain | ₹0 | Zoho Mail free plan or email forwarding |
| Offsite backups | ₹0 to ₹100 a month | Backblaze B2 or Cloudflare R2. The data is small. |
| DNS and CDN, uptime monitor, error tracker | ₹0 | Cloudflare free plan, UptimeRobot or Better Stack free plans, Sentry free plan or self-hosted GlitchTip |
| Trademark | ₹4,500 per class, one time | Plus attorney fees if you use one; renew every 10 years |
| CA for the annual return | ₹1,500 to ₹5,000 a year | More once GST registration is needed |
| **Total to run one site** | **about ₹1,000 to ₹2,500 a month**, plus yearly domain and CA fees | One server can host 3 to 5 small sites (section 9), so each added site costs little more than its domain. |

## 9. Several niche sites from one codebase

### 9.1 Approach

**Don't copy the repository for each site.** With five copies, every bug fix and security patch has to be made five times, and the copies drift apart until they can't be merged. Instead, use **one codebase and one Docker image, run as several separate sites**. The project already reads its configuration at runtime, so one image works in every environment.

| Layer | Per site | Shared |
|---|---|---|
| Code and Docker image | — | One |
| Brand: name, tagline, domain, contact, social links, logo, ad ID, analytics | Settings in each site's `.env` | The code that reads them |
| Look: colors, fonts, spacing, layouts | A theme chosen by `SITE_THEME` | The theme system |
| Data: MongoDB database, uploads folder, backups | Separate for each site | The MongoDB server can be shared |
| Server | — | One VPS hosts several sites; Caddy routes each domain to its own app container |
| AdSense | Each domain added as a site | One AdSense account |
| Trademark | A name search for each niche name | The network's word mark (for example LEKHLAB) covers the family |

**Why not one server process for every domain (multi-tenant)?** It's cheaper at large scale, but every query must be scoped by site, one bug can leak data between sites, and backups and DPDP requests get harder. Separate deployments stay simple and safe for up to about 10 sites; reconsider only if hosting cost becomes a real problem.

### 9.2 Brand settings

"Vedev.Guru" is written directly into 22 places across 14 files in `src/` (Code), so a renamed or second site would show the wrong name. Each moves to runtime settings (`src/libs/runtime-config.ts`):

| Where | File |
|---|---|
| Footer copyright | `src/components/layout/Footer.tsx` |
| Home page hero | `src/components/layout/Hero.tsx` |
| Wordmark (logo text) | `src/components/marginalia/Wordmark.tsx` |
| Page titles and Open Graph site name | `src/app/layout.tsx`, `src/app/posts/[slug]/(read)/page.tsx` |
| Web app manifest | `src/app/manifest.ts` |
| Login and register text | `src/app/auth/login/LoginForm.tsx`, `src/app/auth/register/RegisterForm.tsx` |
| Legal pages | `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/about/page.tsx` |
| RSS feed title | `src/app/feed.xml/route.ts` |
| Email sender and email text | `src/libs/mailer.ts`, `src/libs/account-emails.ts` |

Planned settings: `SITE_NAME`, `SITE_SHORT_NAME`, `SITE_TAGLINE`, `SITE_PUBLISHER` (the network name), `SITE_THEME`, `SITE_CONTACT_EMAIL`, `ADSENSE_CLIENT_ID`, plus a logo and icon folder for each site.

### 9.3 Themes ("fresh UI/UX for each site")

1. **Design tokens:** each theme sets its own colors, fonts, corner radius and spacing as Tailwind 4 CSS variables. This alone makes sites look clearly different.
2. **Swappable layouts:** each theme can replace the parts readers notice most: header, home page hero and post grid, post card, post page layout and footer. A component registry keyed by `SITE_THEME` picks them.
3. **Shared everywhere:** the editor, dashboard, auth, moderation, notifications and API stay the same on every site, so features and fixes reach every site at once.
4. **Adding a site** means writing one theme folder and one `.env`, buying a domain, adding a Caddy route and creating a database. No platform code changes.

### 9.4 Rules for running several sites

- **One niche per site, with original, useful content.** Google treats a network of quickly made, low-value sites as spam, and AdSense rejects them. Fewer, better sites earn more.
- **Start the second site only when the first has traction:** for example, steady growth in search traffic and about 50 posts. Running two weak sites is worse than one good one.
- **Link between sites only where it helps readers.** Mass cross-linking looks like a link scheme.
- **Release all sites together:** build the image once, run the tests once, then roll it out to every site, so they never drift apart.

## 10. Private posts

Built (Code). An author ticks "Private: only I can see this post" in the editor:

- **Who sees it:** only the author. Readers, moderators and admins get "not found" for the post, its editor and its revisions. It never appears in lists, search, the sitemap, RSS, the review queue or the admin lists, and it never goes public, even if it was approved before (`SHARED_POST` and `manageablePostFilter()` in `src/libs/post-visibility.ts`).
- **Review:** it skips review. Making a waiting post private takes it out of the queue; unticking it sends it to review again, even if it was approved before.
- **Images:** its images are served only to their uploader, with `Cache-Control: private, no-store` (`src/libs/upload-privacy.ts`). A new image is never kept by shared caches until a post is saved with it. Admins see these files in Uploads only as "Private", without preview, details or download.
- **Comments:** it takes no comments.

What "private" still doesn't cover:
- **Copies already made:** making a public post private can't recall copies already saved. Browsers, a CDN and the image optimizer's cache can keep an image served while the post was public for up to a year.
- **Breaches:** the post is still stored on the server and in backups, so a breach exposes it. Keep truly sensitive notes (passwords, IDs, finances) in a password manager or an encrypted notes app, not the blog.

## 11. What to do, in order

Labels:
- **Blocker:** must be done before the site is public.
- **Before ads:** must be done before monetizing.
- **Defer:** do it later.
- **Skip:** not needed now.

### Stage 0: before going public (target 2 to 3 weeks)

| # | Task | Label | Who | Effort |
|---|---|---|---|---|
| 0.1 | Pick the new name (LekhLab recommended, section 2); run the official IP India search (classes 41, 35, 9, 42), MCA company names, WIPO; buy the domains; claim handles | Blocker | You | 1 to 2 hours |
| 0.2 | Domain safety: registrar account in your own name, two-factor login, auto-renew on, WHOIS privacy on, renewal price checked | Blocker | You | 30 minutes |
| 0.3 | Set `SIGNUP_ENABLED` and `COMMENTS_ENABLED`: closed at launch is recommended. Closed removes most intermediary duties and spam work, and email sending becomes optional. The switches are built. | Blocker (decision) | You | Decision |
| 0.4 | Owner-only private posts with private images (section 10) | Built | Agent | Done |
| 0.5 | Legal pages: Terms (18+), About, Contact with the grievance officer, India-specific privacy policy, 18+ checkbox at sign-up. Built; set `OPERATOR_NAME`, `OPERATOR_LOCATION`, `CONTACT_EMAIL` and review the text | Blocker (your review) | Agent built, you review | 1 hour |
| 0.5a | Rename the site in the code once the name is chosen (brand settings, section 9.2) | Blocker | Agent | 1 milestone |
| 0.6 | Deployment: server, DNS, production `.env` and secrets, first admin, backups with offsite copy, restore drill ([docs/deployment-checklist.md](../deployment-checklist.md)) | Blocker | You (accounts), agent (setup) | 1 to 2 days |
| 0.7 | Uptime monitor and error tracker | Blocker, light (week 1 at the latest) | You (accounts), agent | 1 to 2 hours |
| 0.8 | Claim social handles; buy `vedev.in` if available | Recommended | You | 30 minutes |
| 0.9 | Contact email on your domain | Blocker (needed for the Contact page) | You | 30 minutes |
| — | Real logo for the app icons | Defer (the stand-ins work) | You | — |
| — | First CI run on GitHub | Defer | You approve a push, agent fixes | — |
| — | Typo-tolerant search | Skip | — | — |
| — | Company or LLP, Udyam, Shops and Establishments | Skip | — | — |

### Stage 1: first 1 to 3 months after launch

| # | Task | Label |
|---|---|---|
| 1.1 | Google Search Console and Bing Webmaster Tools; submit the sitemap (already generated) | Do first week |
| 1.2 | Write 2 to 3 good posts a week until there are 20 to 30 | Core work |
| 1.3 | File the new name's word mark (for example LEKHLAB) in class 41 as an individual (₹4,500); use ™ after filing | Do in this stage |
| 1.4 | Start the newsletter list (consented sign-up) | Recommended |
| 1.5 | One meeting with a CA: tax form and scheme under the 2025 Act, Profession Tax, record keeping, AdSense tax form | Before ads |
| 1.6 | Have your PAN and a bank account ready for foreign payments | Before ads |
| — | Class 35 trademark | Defer (when you sell ad space directly) |

### Stage 2: monetize (about 20 to 30 posts and steady traffic)

| # | Task | Label |
|---|---|---|
| 2.1 | Code for ads: CSP rules, consent-gated ad slots on public pages only, `ads.txt`, privacy page ad section (section 6) | Before ads (agent milestone) |
| 2.2 | Apply to AdSense; set up its certified consent message for Europe, the UK and Switzerland; submit W-8BEN with PAN; block gambling | Before ads |
| 2.3 | Affiliate programs and a disclosure policy; label every affiliate or sponsored link | With the first affiliate link |
| 2.4 | Keep e-FIRAs and payment reports; track turnover against the ₹20 lakh GST threshold | Ongoing |

### Stage 3: second site (when the first has traction)

| # | Task | Label |
|---|---|---|
| 3.1 | Brand settings (section 9.2) | Agent milestone |
| 3.2 | Theme system: tokens, layout registry, the current look as theme 1 (section 9.3) | Agent milestone |
| 3.3 | Multi-site hosting: per-site `.env`, database, uploads and backups on the same server; Caddy routes | Agent milestone |
| 3.4 | Name search and domain for the niche site; its theme; its AdSense site entry | You and agent |

### Stage 4: later

| Task | When |
|---|---|
| Full DPDP compliance review (notice, consent records, data requests, breach process, retention) | Before about 13 May 2027 (*verify date*) |
| GST registration and LUT filing | When turnover approaches ₹20 lakh a year |
| Premium ad networks | When traffic passes their thresholds |
| Members-only paid posts (Razorpay or Cashfree) | When readers ask for more |
| Open sign-up for other authors (intermediary duties, moderation, email provider) | When you want a community |
| Company or LLP | When revenue, risk or hiring justify it |
| Selling the platform as a product | A separate decision, much later |

## 12. Sources

Fees, dates and rates come from these pages as of 2026-11-03; most are secondary sources, so confirm on the official portals (IP India, MeitY, CBIC and the Income Tax Department, the AdSense help pages) before acting.

- Trademark fees and timeline: [Intepat](https://intepat.com/blog/trademark-registration-fees-india), [Cashfree](https://www.cashfree.com/blog/trademark-registration-india/), [TaxAJ 2026 fees](https://www.taxaj.com/learn/trademark-registration-fees-india/), [Global Law Experts](https://globallawexperts.com/how-much-does-a-trademark-registration-cost-in-india/), [Disytax](https://disytax.com/trademark-filing-checklist/)
- DPDP Rules 2025: [YourStory](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months), [EY](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025), [Grant Thornton](https://www.grantthornton.in/insights/articles/dpdp-act-businesses-should-prepare-now-for-phased-obligations/), [Mondaq](https://www.mondaq.com/india/privacy-protection/1707558/digital-personal-data-protection-rules-2025-highlights), [Storyboard18](https://www.storyboard18.com/digital/breaking-govt-notifies-final-dpdp-rules-sets-staggered-rollout-with-key-obligations-for-data-fiduciaries-84201.htm)
- IT Rules amendments 2025 and 2026: [iPleaders](https://blog.ipleaders.in/it-rules-2026/), [Hogan Lovells](https://www.hoganlovells.com/en/publications/india-introduces-mandatory-labelling-for-ai-and-3hour-takedown-for-illegal-content), [Mondaq](https://www.mondaq.com/india/social-media/1747176/meity-notifies-the-it-amendment-rules-2026), [Outlook Business](https://www.outlookbusiness.com/news/it-rules-amendment-2026-3-hour-takedown-rule-synthetic-content-defined-new-compliance-norms), [Sabrang India](https://sabrangindia.in/synthetic-content-three-hour-compliance-and-the-risk-of-over-removal-analysing-the-it-rules-amendments/), [CyberPeace](https://cyberpeace.org/resources/blogs/cyberpeace-outlook-on-the-2025-amendments-to-the-it-intermediary-guidelines-2021)
- AdSense payments and tax in India: [Xflow](https://www.xflowpay.com/blog/get-paid-from-adsense-in-india), [TaxAJ](https://support.taxaj.com/portal/en/kb/articles/compliance-guide-for-indian-youtubers-monetizing-via-adsense), [Getswipe on GST](https://getswipe.in/blog/post/gst-on-revenue-from-google-adsense-online-advertising), [Disytax on GST for bloggers](https://disytax.com/gst-for-bloggers/)
- AdSense consent requirement (official): [Google consent management requirements](https://support.google.com/adsense/answer/13554116), [Google-certified CMPs](https://support.google.com/adsense/answer/13554020)
- RPM benchmarks: [Upgrowth](https://upgrowth.in/how-to-calculate-google-adsense-earnings-india/), [WeForAds](https://weforads.com/blog/ad-revenue-benchmarks-2026/), [Ranktracker](https://ranktracker.com/blog/comparing-adsense-rpm-in-high-income-vs-low-income-regions), [Panstag](https://www.panstag.com/2026/08/adsense-rpm-dropped-small-blogger-fix.html)
- `.guru` renewal prices: [domainoffer.net](https://domainoffer.net/tld/guru)
- Official portals to verify against: IP India e-filing (ipindiaonline.gov.in), trademark search (tmrsearch.ipindia.gov.in), MeitY (meity.gov.in), Income Tax e-filing (incometax.gov.in), GST (gst.gov.in), AdSense Help (support.google.com/adsense)

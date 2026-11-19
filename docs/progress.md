# CineCircle implementation ledger

Spec: docs/superpowers/specs/2026-11-11-local-app-design.md
Plan: docs/superpowers/plans/2026-11-11-local-app.md

- Ruling: Implement in the user-designated GP folder. There is no git repository, so worktree/commit bookkeeping is inapplicable; preserve originals by recorded SHA-256 and file checks.
- Ruling: The current user request authorizes implementing the previously discussed architecture with the original schema. Proceed inline without another design approval round.
- Pre-flight: frontend consumes only /api JSON; all database details are confined to server modules. Test and development database names are separate. Static catalog/pricing supplements absent columns and is explicitly documented.
- Original SQL SHA-256: 7342e5c743649974cd2773b0476d2f97c4a57f78946032ee18a5f09771ecdb03
- Original ER SHA-256: 34351d61b5d5e319e48807603b95b87fb724b958eea5a86f7ff848dba7fb9682

## Completion evidence

- Task 1: complete. Private MySQL initialized, 22 original tables, seeded records. Backend contract tests observed RED before implementation.
- Task 2: complete. API integration tests GREEN. Review/list CRUD, privacy, concurrent allocation, server prices, competing buyers and failed transactions use real MySQL.
- Task 3: complete. Browser acceptance tests observed RED before page implementation, then GREEN. Five journeys cover discovery/search, review/list CRUD, persistent ticket booking, mobile/dialog keyboard behavior, and followed-member state after login. Desktop/390px screenshots reviewed; 320px checks across eight routes have no horizontal overflow.
- Final: fixed password whitespace handling — regression observed 401 instead of 200, then GREEN.
- Final: fixed tomorrow-as-watched-date — regression observed 200 instead of 400, then GREEN.
- Final: fixed login follow-state refresh — browser regression observed missing followed state, then GREEN.
- Final: fixed zero-rating display and removed fabricated feature fallback — browser regression observed missing 0.0 average, then GREEN.
- Final: fixed unsupported/prototype-named sort modes — API regression observed 500 instead of 400, then GREEN.
- Final: corrected documented managed MySQL minimum to 8.0.30, matching the startup redo-log option. External schema minimum remains 8.0.16; local engine tested is 8.0.46.
- Final: added a disposable-database fault-injection test. A trigger fails the second ticket INSERT after the first ticket, discount link and seat update; all three roll back. 13/13 API tests passed.
- Final review: fresh-context read-only reviewer found no critical ownership, booking or data-reset defects; identified the sort, zero-rating and MySQL-documentation issues above, all addressed.
- Review rulings: live post-write rollback was not exercised by the reviewer, so the author verified it using actual MySQL fault injection. Cross-platform installation and internet-facing production certification remain outside this local build; tested platforms/versions and local session behavior are documented. Visual checks are authored screenshot/mobile checks and automated browser journeys, not a claim of complete assistive-technology certification.
- Review rulings: direct SQL/schema shortcomings, payments, real cinema admission, refunds, timed holds, administration and membership purchasing remain deferred as authorized. Public watched films/watchlists follow the supplied feature document.
- Deferred review minors: none. Existing schema limitations remain in database-review.md.

- Task 4: complete. README, API guide, design/source credits and preserved database review are present. Final evidence: 13/13 API checks, 5/5 browser scenarios; final mobile rerun and production build passed. Original hashes remain unchanged. Local app left running on 127.0.0.1:5173 with API3001 and project-owned MySQL.

## 2026-11-18 Docker and reproducibility

- Added Dockerfile, compose.yaml (app + MySQL 8.4, named volume, health-checked startup) and .dockerignore. Server bind address is configurable through HOST.
- Fresh review findings verified: local Rolldown native binary rejected by macOS (fixed by `npm ci`); /usr/local/mysql 8.0.46 removed and Homebrew MySQL 26.7 crashes on the 8.0 data directory. Launcher now prefers Homebrew mysql@8.4/8.0; README no longer assumes one Mac.
- Setup now fills empty upcoming days with screenings (existing screenings untouched); external MySQL connection is retried while starting.
- Fixed Playwright web-server shutdown (SIGKILL skipped dropping browser-test databases). Added not-found page and registration rules in the sign-up form.
- Evidence: 14/14 API tests and 5/5 browser tests against the Docker MySQL; `docker compose up --build` on a fresh volume served the site and seeded data; schedule refill verified through an app container restart.

## 2026-11-18 Native setup without Docker

- Replaced the private `mysqld` launcher (fragile across MySQL versions) with a connection to a normally installed MySQL server. `npm start` installs dependencies when missing or built for another OS, tries root@127.0.0.1:3306 without a password, otherwise asks for the connection (hidden password, retry on failure), saves `.env`, creates schema/demo data, builds the site when stale and opens the browser. `npm run setup` re-asks. Added `start-windows.bat` and `start-mac.command`.
- Evidence: fresh copy without node_modules started with passwordless MySQL (no prompts); wizard driven through a terminal with wrong then correct password; friendly errors for stopped MySQL and busy port; Linux container with Mac node_modules reinstalled and served; API 14/14 and browser 5/5 on MySQL 8.4 and 26.7; Docker stack unchanged. Windows launcher is untested (no Windows machine available).

## 2026-11-18 UX fixes and Docker-first README

- Sign-in resumes the action that prompted it (follow, like, review, watchlist, watched date, add to list); booking keeps the chosen seats and shows the member price before confirming.
- Booking: seats announce row/number, type and price (or "taken") to screen readers; taken seats are hatched with ×; larger click/tap areas and phone sizes; fixed bottom total/Confirm bar below 800px; "All screenings" returns to the filtered list.
- Cinemas and Films keep their filters in the URL. Cinemas distinguishes "no schedule at all", "not showing on this day" (with a jump to the next showing; empty days dimmed) and "no screenings for this film/cinema".
- Shared Tabs component (tablist/tab/tabpanel wiring, arrow/Home/End keys, roving tabindex) on Library, Tickets and Profile.
- Paging: list routes take limit/offset and return `more`; "Show more" buttons on films, reviews, members, lists and screenings. Profile/library counts come from COUNT queries; the film page returns the viewer's own review separately so it is found beyond the first page.
- Visual: membership expiry shows the year; welcome toast capitalises the name; community members panel stays in view while scrolling.
- README now recommends Docker as Option A for every system; native Windows/macOS are Options B/C.
- Evidence: 15/15 API tests (new paging test) and 8/8 browser tests (new: resume after sign-in, URL filters and empty-day state, tab keys and paging) against disposable MySQL 8.4; production build; Docker stack built and served paged API on spare ports, then removed.

## 2026-11-18 Merge from GP 2 (schema upgrade, docs, menu)

- `CineCircle_MySQL.sql` is now the revised schema (SHA-256 0bf0d8be…0964, identical to GP 2's `CineCircle_MySQL(1).sql`); the earlier "original hashes unchanged" notes refer to the pre-revision file, now kept as `tests/fixtures/CineCircle_MySQL_before_revision.sql`.
- Ported from GP 2: in-place upgrade that adds the five revised constraints to a database created from the earlier SQL (stops before any change when rows conflict), a MySQL named lock around setup, and a table-name check. Setup prints how many constraints it added.
- Ported tests: `tests/schema.test.mjs` (fresh database enforces the rules; legacy database stops on conflict, then upgrades in place, repeat/concurrent setup safe) and two API checks (duplicate email in other case → 409; re-submitting a review keeps its ID).
- Phone menu: Escape closes it and returns focus to the menu button; button is linked to the navigation with aria-controls.
- README and `database-review.md` now describe the revised schema and the upgrade.
- Evidence: 17/17 API and schema tests and 8/8 browser tests on MySQL 26.7; production build; Escape/focus checked at 390px.

## 2026-11-18 Design: GP 2 look with the earlier home layout

- Adopted GP 2's visual design (charcoal and lavender palette, Baskervville spotlight title, plain labels, poster cards, film stills on the film page and above the seat map, cream booking ticket) by three-way merging GP 2's front end with this version against the recovered pre-edit sources, so paging, sign-in resume, URL filters, seat labels, the phone booking bar and the empty-day states are kept. Films uses GP 2's route-driven filters plus paging.
- Home keeps the earlier layout (feature film beside the next screening, film shelf, reviews beside a side panel) in the new look: the feature still fades into the page, the next screening is a cream admission ticket, and the side panel shows a public community list whose covers fade out.
- Added a finishing layer: film grain, gilded medallions for decorative icons (empty states, cinema locations, screenings, tickets, home), satin tabs (home shelf, Library/Tickets/Profile) and a recessed current-page marker in the header.
- Evidence: 17/17 API and schema tests, 8/8 browser tests, production build; desktop and 390px screenshots reviewed.

## 2026-11-18 Classic films, spotlight, wordmark and ticket

- Catalogue: ten classic Hollywood films (IDs 13–22, TMDB w500 posters matching the existing ones, two new genres appended so existing genre IDs are unchanged) and four members (eleanor, theo, rosa, sam) with reviews, follows, likes, a public list and watchlist entries. `extendCatalog` adds any missing films and, once, the new members to an existing database; verified on a simulated 12-film database (adds 10 films and 4 members, second run adds nothing).
- Home: six-film spotlight (Casablanca, The Grand Budapest Hotel, Rear Window, In the Mood for Love, Singin' in the Rain, Roman Holiday) switched from a film reel with previous/next and arrow keys; stills crossfade. The admission ticket follows the selected film's next screening.
- Booking: the film still above the seat map is replaced by a drawn gilded screen.
- Wordmark: "CineCircle" in Cinzel with gilded rings, shared by header and footer (`BrandMark.vue`). Page titles use Baskervville.
- Tests updated for the larger catalogue and the spotlight (switch by click and arrow key). Evidence: 17/17 API and schema tests, 8/8 browser tests; `docker compose up --build` on a fresh volume (22 films, 8 members) and an app restart keeping data, on spare ports, then removed.

## 2026-11-18 Database review follow-up and fixed spotlight size

- Schedule: `refreshSchedule` (fill empty days, then `scheduleEveryFilm`) runs on every start and hourly while the server runs, so a long-running site keeps ten upcoming days. Films with fewer than two upcoming screenings get a morning show ending by 12:45 in a hall whose morning is free; covers films added to an older database. Simulated a database seeded a week earlier: the refresh restored ten upcoming days and every film is showing.
- Watched dates earlier than the film's release are rejected (server and date picker). Database-level rule violations (check constraints, missing or referenced rows) return 400/409 with a clear message instead of 500.
- Home: all spotlight texts and ticket texts share one grid cell each, so the card and ticket keep the height of the longest film (616px at 1440, 555px at 1100, constant at 390).
- Evidence: 18/18 API and schema tests (new: release-date rule; every film scheduled, idempotent, no same-hall overlap, new seats bookable), 8/8 browser tests, production build.

## 2026-11-18 Spotlight motion and controls

- The spotlight turns every 12 s (first 7 s, lengthened so the motion stays in the background); the current marker's fill animation is the timer, so pausing the animation pauses the turn. Paused while the pointer or focus is on the spotlight or ticket, with the pause button, and (via the reduced-motion rule) never turns for visitors who reduce motion. Live-region announcements only while paused.
- The thumbnail reel left the frame: hidden edge bands bring up gilt arrows on hover or keyboard focus; hairline markers, count and pause sit below the frame (above the ticket in one column); swipe on touch screens, where the edge bands are hidden.
- Titles allow 16ch, so every featured title fits two lines; the frame stays 500px for all six films at 1440px.
- Evidence: scripted check (turned after 7 s before the change, stays while hovered, arrow opacity 0 mid-frame and 1 at the edge, fixed size), 18/18 API and 8/8 browser tests.

## 2026-11-18 Spotlight timer fix and split layout

- Rotation stopped after any click on an arrow: focus stayed inside the spotlight and focus paused it. Replaced the animation-driven timer with a 7 s timeout that pauses only for hover or keyboard (focus-visible) focus, restarts after every change, skips hidden tabs and reduced motion. Markers and pause button removed. Previous/next wrap around in both directions.
- Layout: text overlapped faces in several stills (Rear Window, Roman Holiday) and the Budapest synopsis sat on the bright facade. The frame is now split: text panel `max(360px, 50%)` on the left with vertically centred copy, the still on the right reaching 110px under the panel and fading out across that seam. Per-film `spot` crops in `film-programme.js` keep the people on the photo side; the film page keeps its own `focus` crops. On narrow screens the photo is a band above the text and the arrows cover only that band.
- Evidence: scripted check (turns at 7 s and 14 s, keeps turning after a mouse click once the pointer leaves, holds while hovered, Next from the last film shows the first and Previous goes back), all six films reviewed at 1440, 1100 and 390px, 18/18 API and 8/8 browser tests (spotlight test now uses the arrows and checks wrapping).

## 2026-11-18 Spotlight back to the fading frame, with films chosen for it

- The split text/photo frame read as a card; returned to the original frame: the still covers the right 72% (64% at 901–1250px) and fades into the dark behind the text; text column `min(600px, 66%)` (56% at mid widths), titles two lines, text centred vertically. Hidden edge arrows, 7 s looping rotation and swipe unchanged.
- Rather than trade crops against text, the spotlight now uses films whose stills keep their people on the right: Casablanca, Rear Window (new still: Jeff with his camera), In the Mood for Love, Singin' in the Rain, Roman Holiday and La La Land (new still: the dance above Los Angeles). The Grand Budapest Hotel left the spotlight (its stills are full-width or symmetrical); Breakfast at Tiffany's was tried and dropped because Holly sits mid-frame. All six have member reviews and are guaranteed screenings by `scheduleEveryFilm`.
- Evidence: all six reviewed at 1440, 1100 and 390px with no text over a face; 18/18 API and 8/8 browser tests.
- Follow-up: the still now fills the whole frame (about 16:9, so it is barely cropped) and fades towards the side holding the text; each spotlight film sets `side` (Casablanca and Singin' in the Rain put text on the right) and `frameX` (which part stays in view on narrower frames). Text block 360px (300px and 48px titles at 901–1250px). Reviewed all six at 1440, 1100 and 390px.
- Per-film tuning: `titleScale`/`lift` (Casablanca 1.14 and 14px, applied with `translate` so the frame keeps its size) and `quote` (La La Land shows the first sentence of its most-liked member review, loaded from `/reviews?movieId=`; omitted if none). Frame stays 503px at 1440. Baskervville italic added for the quote.
- Roman Holiday: a quote was tried but grew the frame (503 to 577px, as its text is already among the tallest), so it got only a slight `titleScale` 1.03 and `lift` (10px, later 16px). Frame unchanged.
- La La Land's quote is now a line from the film (`quote: { line, by }` in `film-programme.js`), “Here’s to the fools who dream.” credited to Mia Dolan; the member-review loading was removed. Frame unchanged.

## 2026-11-18 Concierge and printed buttons

- `.button.concierge` (style.css): gilt hairline, translucent dark ground, pearl small capitals, gilt hover with the arrow easing forward; used for Film details and Sign in. Header search restyled to match (gilt hairline, gilt icon, Baskervville italic placeholder). Choose seats on the ticket stays 2D: flat plum, letter-spaced capitals, inner printed rule (outline offset), darker on hover. The lavender primary button elsewhere is unchanged.

## 2026-11-18 One visual language across the site

- Audit of every page (signed out and in) and the dialogs found two accents (lavender controls beside the gilt details) and two title fonts. Lavender retired: `--accent` is now champagne (#e3c995), `--accent-surface` warm dark; hard-coded lavender shades replaced (seats are plum velvet with a gilt chosen seat, community rings and the booking screen glow are gilt).
- House style block (end of style.css): primary buttons are champagne satin in small capitals; secondary buttons are gilt hairlines; header links are small capitals with the current page in a hairline pill; genre chips and the date strip use the same pill, gilt when chosen; every h1, dialog title and empty-state heading is Baskervville; placeholders are Baskervville italic; the booking ticket's button is printed like the home ticket's.
- Evidence: all pages and both dialogs reviewed at 1440px, home and phone menu at 390px; 18/18 API and 8/8 browser tests.

## 2026-11-18 Glass pills and brass stars

- Frosted glass (`--glass`, `--glass-edge`, `--glass-depth` in style.css) on every hairline pill: concierge and secondary buttons, header search, current page, genre chips. Hover brightens the glass and gilds the edge; selected pills keep a gilt edge.
- Rating stars use a shared brass gradient (`#cc-brass`, defined once in App.vue) with a darker rim and hairline shadow.
- Italic placeholders removed everywhere; the header search prompt is small spaced capitals.
- Evidence: 2x close-ups of header, home hero, film page and catalogue; 18/18 API and 8/8 browser tests.
- Stars: flat brass replaced by metal: a diagonal polished-brass gradient plus `#cc-metal` (fine horizontal brushing from fractal noise, a specular bevel lit from the upper left, a hairline drop shadow), darker rim. Toned down once so the highlight does not wash the brass out.
- La La Land quote and credit hot-stamped: gold-foil gradient with grain clipped to the text and a debossed edge (dark above, faint light below); size, weight and italic unchanged.

## 2026-11-18 Print and ink

- Tickets (home, booking summary, My tickets stubs) separate pre-printed stock (plum labels, house name) from stamped details (Courier Prime, near-black, slight ink bleed); serial numbers in red; punched perforation instead of dashed tear lines; ink speckle on printed buttons. Tokens `--typewriter`, `--ink-plum`, `--ink-black`, `--ink-red`, `--ink-bleed`, `--perforation`, `--ink-speckle` in style.css. `@fontsource/courier-prime` added.
- La La Land: credit back to plain gilt; quote foil brightened (lighter stops, softer upper shadow), same grain, size and italic.
- Evidence: 2x captures of the home ticket at 1440/1100/390, booking ticket with two seats and member price, a booked stub, the quote; 18/18 API and 8/8 browser tests.
- Stars: outline removed; compared bevelled brass with dark golden foil at 3x in four places (film page, poster badge, spotlight, review) and chose foil (`#cc-foil` with `#cc-foil-grain`) to match the hot-stamped quote. Brass (`#cc-brass`, `#cc-metal`) stays defined as an alternative.

## 2026-11-18 Silver foil quote and wide-screen ticket

- La La Land quote foil changed from gold to near-white silver (same grain, bands, size and italic).
- From 1441px the spotlight frame grows to about 585px; the home ticket's contents now grow with it (larger poster, title, field values, time and row spacing), cutting the blank above the tear line from about 124px to about 52px at 1512–1920px. At 1440px and below the ticket is unchanged; the frame never grows.

## 2026-11-18 Claret velvet and wine ink

- The cold plum of the seats and ticket ink became a smoky, low-saturation claret (between muted burgundy and oxblood; terracotta rejected as it fights the champagne and cream). Tokens: `--velvet`, `--velvet-rim`, `--velvet-shadow`, `--velvet-hover`, `--velvet-text`, `--velvet-deep`, `--piping`, `--wine-ink`, `--wine-ink-deep`, `--ink-wine` (replaces `--ink-plum`). Booking ticket text moved from violet grey to warm charcoal; taken-seat hatching is warm neutral. Premium seats are deeper claret with gold piping instead of olive. The red serial number stays brighter red.

## 2026-11-18 Comments, premium block, tickets in My circle

- Comments: new `review_comment` table (23 tables) with FKs to review and users, a non-empty CHECK and a (review_id, create_date) index. API: list, post (locks the review), delete (comment author or review author); reviews carry `commentCount`; deleting a review deletes its comments. UI: a Comment button with count on every review card opens a thread with a posting box; signed-out visitors are sent to sign in and the box is focused after. Eight demo comments.
- Older databases: setup creates the one known added table (anything else still counts as a foreign database), adds the demo comments once, and moves halls still on the first seat plan (row F premium) to the current one. Simulated on a database without the table and with row F premium: 1 schema change, 2 halls, 8 comments; second run changes nothing.
- Premium seats are the middle four of rows D–F (12 per hall), black velvet with gold piping.
- My circle has a Tickets tab (upcoming tickets, soonest first; link to the full history). `TicketCard.vue` is shared with My tickets.
- ER: `CineCircle_ER_updated.png` = the supplied diagram plus a panel (same notation and colours) with Comment, Posts (to User) and On (to Review), total participation on the Comment side. The supplied PNG is unchanged.
- Evidence: 20/20 API and schema tests (new: comment rules, premium layout, upgrade creates the table), 9/9 browser tests (new: post and remove a comment, Tickets tab).

## 2026-11-18 Notification centre and following feed

- Notifications are derived, not stored: `server/routes/notifications.mjs` gathers comments on your reviews, replies after your comment in other conversations, follows, ticket bookings (one per screening and booking minute) and reminders (screenings you hold tickets for that start within the hour, dated an hour before) with one UNION ALL query. `users.notifications_read_at` (new column; older databases get it on setup) marks what is unread. Opening the panel marks all read.
- Header bell (`NotificationBell.vue`): gilt unread count, glass panel with medallion icons, quoted text and relative times; checks every 45 s and on focus; new comments, replies, follows and reminders pop up as a toast (bookings do not, the booking page confirms them). Comment links open the film page with that review's conversation open (`?thread=`).
- Community feed: Everyone / People you follow (`/reviews?following=1`, signed in).
- ER: User gains `notifications_read_at`; no new entity. `CineCircle_ER_updated.png` replaces the earlier comments-only file.
- Evidence: 22/22 API and schema tests (new: every notification kind, own comments excluded, read state, following feed, upgrade adds the column), 10/10 browser tests (new: bell count, panel, Escape returns focus, following feed); a comment posted while the page was open popped up as a toast.

## 2026-11-18 Replies, comment likes, bookmarked collections

- Conversations nest to any depth: `review_comment.parent_comment_id` with a composite foreign key keeping a reply under its parent's review. The thread (`CommentThread.vue`) shows two layers at a time; opening a reply makes it the focus, Back returns a level. Notifications link straight to the right level (`?thread=&comment=`), using a recursive path query.
- Comment likes (`comment_like`), not on your own comments. Removing a comment removes its replies and their likes in one transaction (recursive subtree query).
- Following now matters in conversations (followed members' replies first, tagged) and in notifications (their new reviews, only those written after the follow).
- Remove is a bin icon beside Like and Reply.
- Collections can be bookmarked (`list_bookmark`, composite foreign key to film_list); public browse ranks by bookmarks; bookmarked collections appear under Saved in My circle.
- Notifications: comment (top-level), reply (direct replies to you), like, review-like, review, follow, ticket, reminder. "A reply in a conversation you joined" was dropped as too noisy once threads nest.
- ER: Comment Replies_to Comment; User Likes Comment (like_date); User Bookmarks Film_List (bookmark_date). 25 tables.
- Evidence: 26/26 API and schema tests (new: replies at depth, cross-review reply rejected by SQL, likes, subtree removal, followed-first order, bookmarks incl. privacy and deletion, review notifications, upgrade from the first comments release) and 10/10 browser tests (reply, focus, back, bin with confirmation, Saved tab and bookmark toggle).

### Review of this round (fixes)

- A notification link to a film page that was already open did nothing (the card only read the address when it first appeared). Cards now follow address changes, and the conversation reopens at the linked comment.
- A link to a review beyond the first ten on its film page found nothing. That review is now fetched (`/reviews?reviewId=`) and shown first, kept apart from the paged list so "Show more reviews" neither skips nor repeats one.
- An open conversation kept the previous member's likes, following tags and order after signing in or out; it now reloads. Liking while signed out likes after sign-in and shows the true count.
- A link naming a comment from another review is ignored (the conversation opens at the top).
- The Saved tab counted only the first page; `/me/bookmarks` now returns `total`. Saved lists have a stable order for paging.
- Schema upgrade steps are checked one by one (column, key, constraint), so an upgrade interrupted between steps finishes on the next start.
- Deleting a review now says its conversation goes with it.
- Evidence: 26/26 API and schema tests, 11/11 browser tests; the new browser test fails without the address-change fix.

### Sign-in prompts (follow-up)

- Regression fixed: moving the conversation into `CommentThread.vue` had dropped the review `like` function from `ReviewCard.vue`, so review Like buttons did nothing. Restored; a browser test now likes a review (and fails on page errors).
- Every action that needs an account asks a signed-out visitor to sign in, then finishes it: liking a review or comment, replying, commenting, following, the following feed, bookmarking, watchlist, watched date, review, adding to a list, booking. Reply now asks straight away (it used to open the comment with only a sign-in link). Opening My circle or My tickets signed out opens the sign-in dialog. A request the server rejects for an ended session (sessions live in server memory) also opens it.
- Following the same notification again, after closing that conversation, reopens it (the address does not change, so the bell tells the page directly).
- An open conversation shows only its latest load, so signing in while a comment opens cannot show the wrong level.
- Evidence: 26/26 API and schema tests, 13/13 browser tests.

### New list from a film page

- The film page's "Add to a list" dialog has a New list option (name, private or public); it creates the list with the film already in it. `POST /lists` takes an optional `movieId` and adds it in the same transaction, so an unknown film leaves no empty list. With no lists yet, the dialog opens straight on the new-list form.
- Evidence: 27/27 API and schema tests, 14/14 browser tests.

### Bug screening (browser walk-through, signed out and signed in)

- Walked through in a real browser against fresh demo data, recording page errors, console errors and failed requests: every page signed out; every account action signed out (each opened sign-in); reviews (publish, invalid rating, edit, delete with its conversation; counts on the film, Community and My circle); comments (post, like/unlike persisted across reload, remove, reply four levels, Back, author removing another's comment with its reply, removing a focused comment); watchlist and watched (film page and My circle agree); lists (new from film page, no duplicate add, add/reorder/remove on the list page, make public, delete); bookmarks (Saved tab, Community count, ranking, own list has none); follow/unfollow counts; sign out. No errors beyond the expected 404s for a private list and an unknown member.
- Notification centre, driven with a second member acting live, at desktop and phone width. Fixed:
  - Opening the panel marked everything up to "now" as read although the list could be 45 s old, so something arriving in between was never shown as new. Opening now refreshes the list and marks read only up to the newest item shown (`POST /me/notifications/read {upTo}`; the mark never moves back or past now).
  - Items arriving while the panel was open brought the badge back after closing; they are now marked read when shown, and do not pop up while the panel is open.
  - A screening booked less than an hour before it starts had its reminder dated before the booking, so it could count as already read and never pop up. Reminders are now dated no earlier than the booking.
  - Following again (after unfollowing) never popped up: the bell recognised it by kind, item and person. The key now includes the time.
  - Times are kept to the second, so an item arriving in the same second as the newest one shown was treated as read. The bell remembers which items it showed from that second, and others from it still count as new.
- Evidence: 28/28 API and schema tests (new: read up to the newest seen, never backwards, re-follow, late reminder), 14/14 browser tests, and the scripted walk-through at 1440 px and 390 px passing repeatedly.

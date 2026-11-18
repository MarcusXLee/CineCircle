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

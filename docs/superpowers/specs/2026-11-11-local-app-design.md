# CineCircle local implementation

The user authorized a complete local frontend and backend using the existing ER diagram and SQL, with frontend-design applied. The original SQL and ER image are immutable inputs. Implement every feature in CineCircle_Features.md. Preserve the database review in database-review.md for later revisions.

## Decisions

- Vue 3, Vite, Vue Router, Express 5 and mysql2; explicit parameterized SQL.
- All 22 original tables, keys and columns remain unchanged. No extra application tables.
- MySQL runs in a separate project-owned data directory, via a private Unix socket, without touching the existing system service. Support an external MySQL connection through environment configuration.
- English product interface, HKD, Hong Kong calendar/time. Persist user data in MySQL. Sessions are in server memory for this local build.
- User registration/login; title/genre search and sorting; movie detail; own-review CRUD; other-review likes; watchlist and watched dates; list CRUD, movie ordering and visibility; follows and public profiles; cinema/showtime browsing; seat selection, transactional booking, history; premium and eligible fixed discounts.
- Movie visual metadata and pricing/eligibility belong in documented local configuration because the supplied schema has no poster or pre-booking price fields. They are not represented as database columns. Database records remain the source of functional movie/social/ticket data.
- Confirm immediately books up to six seats, all or nothing. No temporary holds, payment integration, cancellations, or administrator subsystem in this scope. Explain the simulated local cinema inventory in the booking flow.
- Backend enforces existing application rules despite absent DB constraints, using transactions and serialization where needed. Known schema limitations remain documented rather than silently migrated.

## Visual plan

Palette: deep sea #142D2C; canvas #102322; surface #1B3533; mint #BCE5CC; pearl #F0F4EE; ticket amber #E2B780. Muted foreground #A8BBB5 is a supporting tone. Contrast and visible focus are required.

Typography: Bricolage Grotesque for feature headlines and the wordmark; DM Sans for navigation, readable reviews, and forms. Local npm font files, no runtime font requests. Headlines 48–68px on desktop, 36px mobile; body 15–17px; comfortable reading measures.

Layout: a cinema-club lobby, with a large image-led feature and a compact screening invitation beside it, a poster shelf below, and a quieter community section. Poster art gets unframed space, reviews use horizontal separators, and forms/tickets get distinct surfaces. Main text is left aligned. Detail pages connect directly to reviews and screenings. The seat map centers the screen and physical rows.

```
wordmark   Discover / Films / Community / My circle       Search / Account
[ Featured film image + title, synopsis, actions ][ Tonight's screening ]
Popular with the circle                        Browse all
[poster] [poster] [poster] [poster] [poster] [poster]
[Recent reviews                              ][Member invitation]
```

Review of plan: replace a generic marketing hero with a specific featured movie and live showtimes. Use varied content structures instead of equal rounded cards. The memorable element is the feature film image; surrounding navigation and controls stay restrained. Mint is soft rather than neon, and amber exclusively marks ticketing/member benefits. Avoid all-caps labels, decorative counters, and unnecessary motion.

## Validation

API integration tests use a separate disposable database with the original schema. Test auth, ownership/privacy, review CRUD, list ordering/deletion, watching and following, server prices, booking races and rollback. Browser tests exercise the real UI against the local API, including account actions and booking, plus mobile overflow and keyboard dialogs. Build and inspect desktop/mobile screenshots. Verify original input hashes.

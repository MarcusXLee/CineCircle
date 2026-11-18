# CineCircle API and SQL guide

All routes begin with `/api`. JSON bodies/responses; errors use `{ "error": "human-readable message" }`. Sessions use the HttpOnly, SameSite=Lax `cinecircle.sid` cookie. Mutating requests with a foreign Origin are rejected. No database credentials are sent to the browser.

## Routes

| Method and route                                        | Purpose                                                                                                                                                      |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GET /health                                             | Check API/database connectivity                                                                                                                              |
| GET /session                                            | Current user, or null                                                                                                                                        |
| POST /auth/register                                     | `{username,email,password}`; new regular account and login                                                                                                   |
| POST /auth/login                                        | `{username,password}`; username can also be an email                                                                                                         |
| POST /auth/logout                                       | End session                                                                                                                                                  |
| GET /genres                                             | Genre options                                                                                                                                                |
| GET /movies?q=&genre=&sort=&limit=&offset=              | Catalog; sort: popular, rating, newest, title. Paged (default 100); adds `total`, `more`                                                                     |
| GET /movies/:id                                         | Movie, aggregate ratings, first 10 reviews (`more.reviews`), `myReview`, own flags, screenings                                                               |
| GET /reviews?userId=&movieId=&limit=&offset=            | Recent reviews, optionally for one member or film. Paged (default 10)                                                                                        |
| PUT /movies/:id/my-review                               | `{rating,text}`; create/update current user's review                                                                                                         |
| PATCH /reviews/:id                                      | `{rating,text}`; author only                                                                                                                                 |
| DELETE /reviews/:id                                     | Delete own review and dependent likes in a transaction                                                                                                       |
| PUT /reviews/:id/like                                   | Like another member's review; idempotent                                                                                                                     |
| DELETE /reviews/:id/like                                | Unlike                                                                                                                                                       |
| GET /me/library                                         | Own watched/watchlist movies                                                                                                                                 |
| PUT /me/watchlist/:movieId                              | Add to watchlist                                                                                                                                             |
| DELETE /me/watchlist/:movieId                           | Remove from watchlist                                                                                                                                        |
| PUT /me/watched/:movieId                                | `{date:"YYYY-MM-DD"}`; mark watched, remove watchlist entry                                                                                                  |
| DELETE /me/watched/:movieId                             | Remove watched mark                                                                                                                                          |
| GET /users?limit=&offset=                               | Members and follow flags/counts. Paged (default 20)                                                                                                          |
| GET /users/:id                                          | Profile with `reviewCount`/`listCount`; first page of lists and reviews (`more.lists`, `more.reviews`); watched/watchlist; own private lists when authorized |
| PUT /users/:id/follow                                   | Follow another member                                                                                                                                        |
| DELETE /users/:id/follow                                | Unfollow                                                                                                                                                     |
| GET /lists?userId=&public=1&limit=&offset=              | Public lists plus viewer's own private lists (`public=1`: public only), optionally one owner's. Paged (default 12)                                           |
| GET /me/lists?limit=&offset=                            | Current user's lists. Paged (default 12)                                                                                                                     |
| POST /lists                                             | `{name,description,visibility}`; create owner-local ID                                                                                                       |
| GET /lists/:userId/:listId                              | Accessible list and ordered films; private foreign list returns404                                                                                           |
| PATCH /lists/:userId/:listId                            | Update own name/description/visibility                                                                                                                       |
| DELETE /lists/:userId/:listId                           | Delete own list and entries                                                                                                                                  |
| POST /lists/:userId/:listId/movies                      | `{movieId}`; append film                                                                                                                                     |
| DELETE /lists/:userId/:listId/movies/:movieId           | Remove film                                                                                                                                                  |
| PUT /lists/:userId/:listId/order                        | `{movieIds:[...]}`; exact current set in desired order                                                                                                       |
| GET /cinemas                                            | Cinema contacts/locations                                                                                                                                    |
| GET /screenings?movieId=&cinemaId=&date=&limit=&offset= | Future showtimes. Paged (default and maximum 200)                                                                                                            |
| GET /screenings/:id                                     | Screening and physical seat layout/status                                                                                                                    |
| POST /bookings/quote                                    | `{screeningId,seatIds:[...]}`; authoritative eligible offer and prices                                                                                       |
| POST /bookings                                          | Same body; confirm 1–6 distinct seats atomically; client price ignored                                                                                       |
| GET /me/tickets                                         | Current user's ticket history                                                                                                                                |

**Paging.** List routes take `limit` (capped at 100, or 200 for screenings) and `offset`, and return `more: true` when another page exists. The server reads one row beyond `limit` to decide this, so no separate count query is needed; `/movies` also returns `total` for the result count. The browser's "Show more" buttons request the next `offset`.

## Key SQL to explain in the presentation

- **Catalog aggregation:** `movieSelect` in `server/catalog.mjs` uses correlated genre, AVG(rating) and review-count subqueries. Ratings are aggregated independently of genre/list joins so join multiplication does not distort averages.
- **Film search:** parameterized title LIKE and genre EXISTS, with whitelisted sort expressions. IDs and body values are validated before querying.
- **Composite keys:** list paths contain userId/listId; ownership uses both. Seat queries join cinema_id/hall_id/seat_id together; no physical-seat shortcut bypasses the original keys.
- **Private lists:** read predicates are `visibility='public' OR user_id=currentUser`. Mutation checks compare owner with the session identity.
- **Owner-local list ID:** lock the user's existing row with FOR UPDATE, then MAX(list_id)+1 within the same transaction. Concurrent requests for that user cannot allocate the same ID.
- **List edits/order:** lock the film_list row, verify the complete current movie set, update positions, and touch parent update_date. A stale/incomplete permutation receives409.
- **Delete CRUD:** review_like rows are removed before review; film_list_movie rows before film_list. A single transaction prevents partial deletion.
- **Booking:** begin a transaction on one pool connection; lock screening and selected screening_seat rows in a stable order; verify complete selection and availability; calculate prices; INSERT ticket and ticket_discount; UPDATE seat status; COMMIT. Exceptions roll back every write. The original unique seat constraint is an additional guard.
- **History:** JOIN ticket → screening/movie/cinema/hall and screening_seat → seat, scoped by session user_id. The client cannot request another user's history by supplying a user ID.

The schema permits writes outside these application rules. That limitation and future database-level protections are preserved in `../database-review.md`.

# CineCircle

A local movie community and cinema booking website. Vue 3 / Vite frontend, Express 5 API, and MySQL with the **revised 22-table schema** in `CineCircle_MySQL.sql`. It keeps the supplied ER image and adds five database rules (unique usernames and emails, one review per member per film, no self-follows, unique seat numbers per hall); see `database-review.md`.

## How to run it

**Recommended: Docker, on any system.** Install one program (Docker Desktop) and run one command. Docker brings its own MySQL 8.4 with the right time zone and settings, so there is nothing to configure, no password to enter, and the site behaves the same on Windows, macOS and Linux. Resetting to fresh demo data is also one command. See [Option A](#option-a-docker-recommended-windows-macos-or-linux).

**Without Docker**, CineCircle runs on a normal MySQL installation. Use this if Docker cannot be installed (for example on a locked-down lab computer):

| Your computer                      | Method                                                                                                                                                                      | Install first                |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| Windows 10 or 11                   | [Option B](#option-b-windows-without-docker): double-click `start-windows.bat`                                                                                              | Node.js and MySQL Server     |
| macOS 13 or newer (Apple or Intel) | [Option C](#option-c-macos-without-docker): double-click `start-mac.command`                                                                                                | Node.js and MySQL Server     |
| Linux                              | [Option A](#option-a-docker-recommended-windows-macos-or-linux) (Docker), or `npm start` as in [the terminal steps](#without-docker-terminal-commands-and-database-details) | Docker, or Node.js and MySQL |

Options B and C need **Node.js 22.18 or newer** (the current LTS is recommended) and **MySQL Server 8.0.16 or newer** (8.4 LTS recommended; tested on 8.4 and 26.7). MariaDB and SQLite cannot run this schema. Every option opens the site at **http://localhost:3001** with the demo data below.

## Option A: Docker (recommended; Windows, macOS or Linux)

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows, macOS) or Docker Engine with Compose v2 (Linux), and start it. Node.js and MySQL are not needed.
2. Open a terminal in this folder (Windows: in File Explorer, type `cmd` in the address bar and press Enter; macOS: right-click the folder → New Terminal at Folder) and run:

```sh
docker compose up --build
```

3. Open **http://localhost:3001** once the log shows `CineCircle API: http://0.0.0.0:3001`. The first run downloads images and builds the site, which takes a few minutes; later starts take seconds.

What happens:

- `db` runs MySQL 8.4 with an empty `cinecircle` database, Hong Kong time (`+08:00`) and its files in the Docker volume `cinecircle_db-data`.
- `app` waits until MySQL is healthy, then runs `node scripts/db.mjs init`. On an empty database this executes `CineCircle_MySQL.sql` (22 tables) and inserts the demo data listed below. On later starts, existing data is retained. It then serves the built site and the API on port 3001.

| Task                     | Command                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------- |
| Run in the background    | `docker compose up --build -d`                                                                      |
| Stop (data is kept)      | `docker compose down`                                                                               |
| Reset to fresh demo data | `docker compose down -v`, then `docker compose up --build`                                          |
| Follow the app log       | `docker compose logs -f app`                                                                        |
| Open a MySQL shell       | `docker compose exec db mysql --default-character-set=utf8mb4 -ucinecircle -pcinecircle cinecircle` |

**Back up, restore or move to another computer.** Data lives in the Docker volume, not in the image or this folder. To carry your current data to another machine, export a dump, copy the project folder with `backup.sql`, then restore it there before starting the app:

```sh
docker compose exec -T db mysqldump -uroot -pcinecircle-root cinecircle > backup.sql   # export
docker compose up -d --wait db                                                            # on the new machine
docker compose exec -T db mysql -uroot -pcinecircle-root cinecircle < backup.sql        # import
docker compose up --build
```

On Windows, run these in Command Prompt or Git Bash; PowerShell redirection would corrupt the dump. Do not copy MySQL data folders between machines or MySQL versions. Without a dump, the new machine simply starts with fresh demo data.

**Use the Docker database from this computer.** MySQL is also published on `127.0.0.1:3307` (change with `DB_HOST_PORT`). Connect MySQL Workbench or another client with user `cinecircle`, password `cinecircle`, database `cinecircle`. To run `npm run dev` or the tests below without installing MySQL, start only the database with `docker compose up -d --wait db` and create `.env` containing:

```sh
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=root
DB_PASSWORD=cinecircle-root
```

`root` is used here because tests create and drop disposable `cinecircle_test_*` databases.

If port 3001 is busy, choose another: `APP_PORT=8080 docker compose up --build`, then open http://localhost:8080. (In Windows PowerShell, run `$env:APP_PORT=8080` first.) By default the site is reachable from this computer only. To open it from a phone or another computer on the same network, start with `APP_BIND=0.0.0.0` and visit `http://<this computer's IP>:3001`. The demo passwords are public, so do this only on a trusted network.

## Option B: Windows (without Docker)

1. Install **Node.js LTS** from https://nodejs.org (Windows Installer, default choices).
2. Install **MySQL Community Server 8.4 LTS** from https://dev.mysql.com/downloads/mysql/ (Windows MSI). Keep port 3306, set a **root password** you will remember, and keep "Start the MySQL Server at System Startup".
3. Double-click **`start-windows.bat`** in this folder. If Windows SmartScreen appears, choose More info → Run anyway.
4. The first run installs dependencies (about a minute) and asks for the MySQL connection. Press Enter to accept each default and type your root password (it is not shown). The site then opens in your browser.

Keep the window open while you use CineCircle; close it or press Ctrl+C to stop. Later runs start in seconds without questions.

## Option C: macOS (without Docker)

1. Install **Node.js LTS** from https://nodejs.org (macOS Installer), or `brew install node`.
2. Install and start **MySQL 8.4**, either:
   - Homebrew: `brew install mysql@8.4` then `brew services start mysql@8.4` (root has no password, so setup asks nothing), or
   - the macOS DMG from https://dev.mysql.com/downloads/mysql/ (set a root password; it starts MySQL for you).
3. Double-click **`start-mac.command`** in this folder. If macOS says it cannot be opened, right-click it → Open → Open.
4. On the first run, answer the MySQL questions as in Option B if asked. The site then opens in your browser.

Keep the Terminal window open while you use CineCircle; press Ctrl+C to stop.

## Without Docker: terminal commands and database details

| Command         | What it does                                                                                                  |
| --------------- | ------------------------------------------------------------------------------------------------------------- |
| `npm start`     | Installs dependencies if needed, connects to MySQL, creates the database if needed, builds the site, opens it |
| `npm run setup` | Asks the MySQL connection questions again (for example after changing the password), then sets up             |
| `npm run dev`   | Development mode with live reload at http://127.0.0.1:5173 (API on port 3001)                                 |

**Database setup and initial data.** On the first start, setup tries MySQL at `127.0.0.1:3306` as `root` without a password and asks for the connection only if that fails. Answers are saved in `.env` (this includes the password, so do not share or submit `.env`). If the database (default `cinecircle`) does not exist, setup runs `CineCircle_MySQL.sql` to create all 22 tables, then inserts the demo members, films, reviews, lists, cinemas, screenings and tickets. An existing CineCircle database is reused and never reset. To start again with fresh demo data, run `DROP DATABASE cinecircle;` in MySQL and then `npm start`. If a different database with that name already exists, setup stops without changing it; run `npm run setup` and choose another name.

**Databases made before the schema revision.** If your `cinecircle` database was created from the earlier SQL, the next start adds the five new rules to it in place and keeps all users, reviews, lists and tickets. If existing rows break a rule (for example two members with the same username), setup names the rule and stops before changing anything. Fix or remove those rows, then start again.

The MySQL account needs permission to create databases and tables, and to alter tables when upgrading an older database (root does). Optional `.env` settings are listed in `.env.example`: `PORT` (default 3001), `DB_SOCKET` for a Unix-socket connection, and `SESSION_SECRET`.

**Viewing the data.** In MySQL Workbench, connect to `127.0.0.1:3306` with the same account and open the `cinecircle` schema, or run `mysql -u root -p cinecircle`.

## Demo accounts

All accounts below use the password **`Cinema2026!`**. You can also register a new regular account.

| Username | Membership                        |
| -------- | --------------------------------- |
| mia      | Premium; 20% off eligible tickets |
| alex     | Regular                           |
| noah     | Regular                           |
| jules    | Regular                           |
| eleanor  | Regular                           |
| theo     | Regular                           |
| rosa     | Regular                           |
| sam      | Regular                           |

The catalogue has 22 films: twelve recent titles and ten classic Hollywood films (Casablanca, Singin' in the Rain, Roman Holiday, Vertigo, Some Like It Hot, Sunset Boulevard, Breakfast at Tiffany's, Rear Window, The Godfather and It's a Wonderful Life). A database created with the earlier 12-film catalogue receives the new films and the four newer members (eleanor, theo, rosa, sam) on its next start; nothing it already holds is changed. Existing screenings stay as they are, and each new film gets morning screenings straight away (see below).

The sign-in dialog includes **Continue as Mia**. Mia's profile starts with watched films, public/private lists and a watchlist. Passwords are stored as salted scrypt hashes. Login sessions are held in server memory; after an API restart, sign in again. Your reviews, lists, watching records, follows and tickets persist in MySQL.

## What you can do

- Search films by title, filter by genre, and sort by rating, popularity, release date or title.
- Read film details, circle ratings/reviews and upcoming screenings.
- Write, edit and delete your own reviews. Like/unlike another member's review.
- Add/remove watchlist entries and record or change a watched date.
- Create, rename and delete public/private film lists; add/remove films and change their order.
- Visit member profiles, follow/unfollow people, and browse public collections.
- Browse sample Hong Kong cinemas, dates and showtimes; select up to six seats and book them in one transaction.
- See premium/eligible offers before confirming and find your booked tickets in persistent history.
- Start an action while signed out (follow, like, review, watchlist, book) and it carries on after you sign in.
- Film and screening filters are kept in the address, so refresh, Back and shared links keep them. Long feeds load more on request instead of being cut off.

The cinema inventory and all bookings are **local demonstrations**. No payment is collected and no real cinema admission is issued. There is no payment, refund, timed-hold or administrator subsystem in this version.

## Schema compatibility and pricing

Application data uses the revised SQL without additional columns/tables. See `database-review.md` for every deferred design issue and the backend protections used by this version.

The schema has no poster, director or pre-booking price fields. Therefore:

- `server/catalog.mjs` supplies presentation metadata and a documented local pricing policy. Film titles, synopses, languages, durations, genres and ratings are queried from MySQL.
- Standard seats cost HK$78 before 17:00 or HK$98 from 17:00; premium seats add HK$25.
- `premium_user.discount_rate` is the **payable multiplier**: 0.8 means pay 80% of the base price, during the stored inclusive validity dates.
- `discount.price` is interpreted as a fixed HKD reduction. The seeded **Weekday matinee** offer takes HK$8 off screenings before 17:00 on Monday–Friday. Eligibility is local configuration, because the schema has no applicability columns.
- The best eligible offer is selected; offers do not stack. Server calculation is authoritative. Client-supplied prices are ignored. `ticket.price` stores the final amount; an applied fixed offer is associated through `ticket_discount`.
- Seat selection in the browser is not a hold. On confirmation, the backend locks the screening/seats, rechecks availability, prices and membership, writes all tickets and statuses, then commits. A failed selection leaves no partial booking.
- Screening dates are relative to today, not fixed. Initial seeding schedules the next ten days. On every start, and every hour while the site is running, any of the next ten days without screenings receives the standard schedule (13:00, 17:00 and 21:00 in each hall), and any film with fewer than two upcoming screenings gets a morning show that ends by 12:45, so it never overlaps the 13:00 screening in that hall. Past screenings simply stop being listed; existing screenings, tickets and user data are never moved. A demo on any later date therefore shows the following ten days.

All screening times and watched dates use Hong Kong time. Seed release dates record the film's release **year** with January 1 as a fixture date; the interface deliberately shows the year only. A watched date cannot be earlier than the film's release date.

## Verify

Run the checks with the Docker database (see "Use the Docker database from this computer" above) or after Option B or C. They use the connection in `.env`; that account must be allowed to create and drop `cinecircle_test_*` databases (root is).

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

API tests and browser tests create independently named **disposable databases** from `CineCircle_MySQL.sql`. A schema test also builds a database from the pre-revision SQL kept in `tests/fixtures/` and checks the in-place upgrade. They do not reset the development database. Browser tests launch a separate API on port 3002 and frontend on 5174. Test databases are dropped on normal completion. Playwright traces and screenshots of failures are written to `test-results/`.

Checks cover real database CRUD, ownership/privacy, list ordering and concurrent list IDs, watched-date bounds, password handling, server-side prices, competing buyers, rollback, real browser journeys, mobile overflow, dialog and tab keyboard behavior, paging, address-bar filters, and finishing an action after sign-in.

## Project map

| Location                                  | Purpose                                                                                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| `CineCircle_MySQL.sql` / original PNG     | Revised database schema / supplied ER image                                             |
| `server/routes/`                          | Accounts, social actions, lists, booking SQL                                            |
| `server/db.mjs`                           | Pool, transactions, schema initialization and in-place upgrade                          |
| `server/seed.mjs`                         | Initial rows across the schema                                                          |
| `server/catalog.mjs`                      | Local presentation and pricing configuration                                            |
| `src/pages/` / `src/components/`          | Vue pages and shared controls                                                           |
| `scripts/`                                | Setup/start (`launch.mjs`, `prepare.mjs`), database setup, dev and browser-test startup |
| `start-windows.bat` / `start-mac.command` | Double-click launchers for Options B and C                                              |
| `Dockerfile` / `compose.yaml`             | Docker image and the app + MySQL stack                                                  |
| `tests/`                                  | API integration and browser tests                                                       |
| `docs/API.md`                             | API contract and key SQL explanations                                                   |
| `database-review.md`                      | Preserved findings and future schema suggestions                                        |
| `docs/design-notes.md`                    | Visual choices and asset credits                                                        |

For a demo video, one compact journey is: sign in as Mia → search a film → create/edit/delete a review → create a private list and add/reorder films → pick a screening and book a seat → reopen ticket history. These operations demonstrate actual SQL reads and writes.

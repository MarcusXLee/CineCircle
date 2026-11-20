import { films } from "./catalog.mjs";
import { hashPassword } from "./auth.mjs";
import { transaction } from "./db.mjs";

const hours = [13, 17, 21];
// Inserts a screening `day` days from today at `hour` (13 or "09:45"), with a status row
// for every seat in its hall.
async function addScreening(c, screeningId, film, cinemaId, hallId, day, hour) {
  const time = typeof hour === "number" ? `${hour}:00:00` : `${hour}:00`;
  const [result] = await c.execute(
    "INSERT INTO screening VALUES(?,?,?,?,TIMESTAMP(DATE_ADD(CURRENT_DATE,INTERVAL ? DAY),?),DATE_ADD(TIMESTAMP(DATE_ADD(CURRENT_DATE,INTERVAL ? DAY),?),INTERVAL ? MINUTE))",
    [
      screeningId,
      film.id,
      cinemaId,
      hallId,
      day,
      time,
      day,
      time,
      film.duration,
    ],
  );
  await c.execute(
    "INSERT INTO screening_seat(screening_id,screening_seat_id,cinema_id,hall_id,seat_id) SELECT ?,seat_id,cinema_id,hall_id,seat_id FROM seat WHERE cinema_id=? AND hall_id=?",
    [result.insertId, cinemaId, hallId],
  );
}

export async function seedDatabase(pool) {
  const [[counts]] = await pool.query(
    "SELECT (SELECT COUNT(*) FROM users) AS users,(SELECT COUNT(*) FROM movie) AS movies",
  );
  if (counts.users || counts.movies) return false;
  const hash = await hashPassword("Cinema2026!");
  await transaction(pool, async (c) => {
    for (const [userId, username, email] of [
      [1, "mia", "mia@cinecircle.local"],
      [2, "alex", "alex@cinecircle.local"],
      [3, "noah", "noah@cinecircle.local"],
      [4, "jules", "jules@cinecircle.local"],
    ]) {
      await c.execute(
        "INSERT INTO users(user_id,username,password_hash,user_type) VALUES(?,?,?,?)",
        [userId, username, hash, userId === 1 ? "premium" : "regular"],
      );
      await c.execute("INSERT INTO user_email VALUES(?,?)", [userId, email]);
      if (userId === 1)
        await c.execute(
          "INSERT INTO premium_user(user_id,start_date,expiry_date,discount_rate) VALUES(?,CURRENT_DATE,DATE_SUB(DATE_ADD(CURRENT_DATE,INTERVAL 12 MONTH),INTERVAL 1 DAY),0.8)",
          [userId],
        );
      else
        await c.execute("INSERT INTO regular_user(user_id) VALUES(?)", [
          userId,
        ]);
    }
    const genres = [...new Set(films.flatMap((f) => f.genres))];
    for (let i = 0; i < genres.length; i++)
      await c.execute("INSERT INTO genre VALUES(?,?)", [i + 1, genres[i]]);
    for (const f of films) {
      await c.execute("INSERT INTO movie VALUES(?,?,?,?,?,?)", [
        f.id,
        f.title,
        f.description,
        f.duration,
        `${f.year}-01-01`,
        f.language,
      ]);
    }
    for (const f of films)
      for (const genre of f.genres)
        await c.execute("INSERT INTO movie_genre VALUES(?,?)", [
          f.id,
          genres.indexOf(genre) + 1,
        ]);
    const reviews = [
      [
        2,
        1,
        9.5,
        "Some films tell you a story. This one leaves you with a feeling. The corridors, the glances, that impossibly beautiful score — I could live in these frames.",
      ],
      [
        3,
        1,
        9,
        "Watched it on the big screen for the first time. Every shade of red feels like a memory you haven’t made yet.",
      ],
      [
        4,
        2,
        8.5,
        "A little box of cinematic pastries. Every composition is a delight, but it’s the friendship at the centre that makes me come back.",
      ],
      [
        2,
        3,
        9,
        "A reminder to look up at the trees. The smallest moments carry the most weight.",
      ],
      [
        3,
        4,
        8.5,
        "The quietest goodbye can be the one that stays with you longest. Still thinking about that last scene.",
      ],
      [
        4,
        5,
        9,
        "Like trying to remember a dream, and realising the dream was your childhood.",
      ],
      [
        1,
        6,
        9.5,
        "The film that made the world feel a little bigger when I was small. It still does.",
      ],
      [
        3,
        7,
        9,
        "A love letter sent through a black hole. Spectacular in a cinema.",
      ],
      [
        2,
        8,
        8.5,
        "The sound alone is worth the ticket. A world you can almost feel beneath your feet.",
      ],
      [4, 9, 9, "Come for the multiverse. Stay for the kindness."],
      [
        1,
        10,
        8,
        "The colours, the music, the ending. Some dreams are worth following even when they change shape.",
      ],
      [
        2,
        11,
        9,
        "Science fiction at its most human. The ending changes everything that came before it.",
      ],
    ];
    for (const [index, [u, m, r, t]] of reviews.entries())
      await c.execute(
        "INSERT INTO review(user_id,movie_id,rating,review_text,create_date) VALUES(?,?,?,?,DATE_SUB(NOW(),INTERVAL ? HOUR))",
        [u, m, r, t, reviews.length - index],
      );
    await c.query(
      "INSERT INTO review_like(user_id,review_id) VALUES(1,1),(3,1),(4,1),(1,2),(2,3),(1,4),(4,5),(2,6)",
    );
    await c.query(
      "INSERT INTO follows(follower_id,followed_id) VALUES(1,2),(2,1),(3,1),(4,2),(3,2)",
    );
    await c.query(
      "INSERT INTO wants_to_watch(user_id,movie_id) VALUES(1,1),(1,3),(1,4),(2,5),(3,6)",
    );
    await c.query(
      "INSERT INTO watches(user_id,movie_id,watch_date) VALUES(1,6,DATE_SUB(NOW(),INTERVAL 10 DAY)),(1,10,DATE_SUB(NOW(),INTERVAL 4 DAY)),(2,1,DATE_SUB(NOW(),INTERVAL 2 DAY)),(3,4,DATE_SUB(NOW(),INTERVAL 1 DAY))",
    );
    await c.query(
      "INSERT INTO film_list(user_id,list_id,list_name,description,visibility) VALUES(1,1,'Films that feel like a memory','For the afternoons you want to hold on to.','public'),(1,2,'My next movie night','A few things I’ve been meaning to see.','private'),(2,1,'Love, in every language','Different cities. Familiar feelings.','public'),(3,1,'A little further from Earth','For the curious, the dreamers, and the stargazers.','public')",
    );
    await c.query(
      "INSERT INTO film_list_movie VALUES(1,1,1,1),(1,1,5,2),(1,1,4,3),(1,1,3,4),(1,2,8,1),(1,2,12,2),(2,1,1,1),(2,1,4,2),(2,1,10,3),(2,1,12,4),(3,1,7,1),(3,1,8,2),(3,1,11,3),(3,1,9,4)",
    );
    await c.query(
      "INSERT INTO cinema VALUES(1,'The Screening Room','+852 2800 0101','Central','18 Queen’s Road Central','Level 3'),(2,'Harbour Cinema','+852 2800 0202','Tsim Sha Tsui','7 Canton Road','Harbour House')",
    );
    for (const cinema of [1, 2]) {
      await c.execute("INSERT INTO hall VALUES(?,1,?,48)", [
        cinema,
        cinema === 1 ? "The Green Room" : "Harbour Hall",
      ]);
      for (let row = 0; row < 6; row++)
        for (let col = 1; col <= 8; col++)
          await c.execute("INSERT INTO seat VALUES(?,1,?,?,?)", [
            cinema,
            row * 8 + col,
            `${String.fromCharCode(65 + row)}${col}`,
            isPremium(row, col) ? "premium" : "standard",
          ]);
    }
    let screeningId = 0;
    // Dates are relative to the first seed; extendSchedule later fills empty upcoming days.
    for (let day = 1; day <= 10; day++)
      for (const cinema of [1, 2])
        for (const hour of hours)
          await addScreening(
            c,
            ++screeningId,
            films[
              ((day - 1) * 3 + (cinema - 1) * 2 + hours.indexOf(hour)) %
                films.length
            ],
            cinema,
            1,
            day,
            hour,
          );
    await c.query("INSERT INTO discount VALUES(1,'Weekday matinee',8)");
    await c.query(
      "INSERT INTO ticket(user_id,screening_id,screening_seat_id,price) VALUES(2,1,19,70),(3,1,20,70),(4,1,29,70)",
    );
    await c.query(
      "UPDATE screening_seat SET status='booked' WHERE screening_id=1 AND screening_seat_id IN(19,20,29)",
    );
    await c.query("INSERT INTO ticket_discount SELECT ticket_id,1 FROM ticket");
    await addClassicCircle(c);
    await addDemoComments(c);
    await addDemoBookmarks(c);
  });
  return true;
}

// Premium seats are the middle four of each row from the middle of the hall to the back
// (rows D to F, seats 3 to 6), where the view of the screen is best.
const isPremium = (row, col) => row >= 3 && col >= 3 && col <= 6;
const premiumSql =
  "LEFT(seat_number,1) IN ('D','E','F') AND CAST(SUBSTRING(seat_number,2) AS UNSIGNED) BETWEEN 3 AND 6";

// Halls still using the first layout (only row F premium) move to the current one. A hall
// whose seat types were changed in any other way is left as it is.
async function updateSeatPlan(c) {
  const [halls] = await c.query(
    `SELECT cinema_id AS cinemaId,hall_id AS hallId,SUM(seat_type='premium') AS premium,
    SUM(seat_type='premium' AND seat_number LIKE 'F%') AS backRow,SUM(seat_number LIKE 'F%') AS rowF
    FROM seat GROUP BY cinema_id,hall_id`,
  );
  let updated = 0;
  for (const h of halls) {
    const firstLayout =
      Number(h.premium) === Number(h.rowF) &&
      Number(h.backRow) === Number(h.rowF);
    if (!firstLayout || !Number(h.rowF)) continue;
    await c.execute(
      `UPDATE seat SET seat_type=IF(${premiumSql},'premium','standard') WHERE cinema_id=? AND hall_id=?`,
      [h.cinemaId, h.hallId],
    );
    updated++;
  }
  return updated;
}

// A few replies under popular reviews, so conversations do not start empty. Added once:
// only when no comments exist yet and the reviews and members they refer to are present.
const demoComments = [
  [
    "alex",
    11,
    "noah",
    "The ending got me too. I went straight back to the first scene.",
  ],
  [
    "alex",
    11,
    "mia",
    "Agreed. It is the kind of twist that leaves you a little kinder.",
  ],
  ["mia", 10, "jules", "That last look across the club. Every single time."],
  [
    "mia",
    10,
    "alex",
    "The epilogue is the bravest five minutes in any musical.",
  ],
  ["eleanor", 13, "theo", "Seeing it on a big screen this year was a gift."],
  [
    "eleanor",
    13,
    "mia",
    "Round up the usual suspects: still my favourite line.",
  ],
  [
    "rosa",
    15,
    "sam",
    "That press-conference ending. Not a dry eye in the house.",
  ],
  ["alex", 1, "noah", "The score alone could carry it."],
  // Replies: the fifth value is the index of the comment being answered.
  [
    "alex",
    11,
    "alex",
    "Same here. The first scene hits differently the second time.",
    0,
  ],
  [
    "alex",
    11,
    "noah",
    "Exactly. I noticed the hands on the glass this time.",
    8,
  ],
  ["mia", 10, "mia", "Thank you both. That look gets me every time.", 2],
];
// [member, index of the comment they like]
const demoCommentLikes = [
  ["mia", 0],
  ["alex", 1],
  ["jules", 3],
  ["noah", 8],
  ["rosa", 5],
];
// [member, list owner, list id]: a few bookmarks, so the most-saved collections lead.
const demoBookmarks = [
  ["mia", "eleanor", 1],
  ["theo", "eleanor", 1],
  ["rosa", "eleanor", 1],
  ["alex", "eleanor", 1],
  ["alex", "noah", 1],
  ["jules", "noah", 1],
  ["sam", "mia", 1],
];
async function addDemoBookmarks(c) {
  const [[{ existing }]] = await c.query(
    "SELECT COUNT(*) AS existing FROM list_bookmark",
  );
  if (existing) return 0;
  const [users] = await c.query("SELECT user_id AS id,username FROM users");
  const idOf = Object.fromEntries(users.map((u) => [u.username, u.id]));
  let added = 0;
  for (const [member, owner, listId] of demoBookmarks) {
    if (!idOf[member] || !idOf[owner] || idOf[member] === idOf[owner]) continue;
    const [result] = await c.execute(
      "INSERT INTO list_bookmark(user_id,owner_id,list_id) SELECT ?,user_id,list_id FROM film_list WHERE user_id=? AND list_id=? AND visibility='public'",
      [idOf[member], idOf[owner], listId],
    );
    added += result.affectedRows;
  }
  return added;
}
async function addDemoComments(c) {
  const [[{ existing }]] = await c.query(
    "SELECT COUNT(*) AS existing FROM review_comment",
  );
  if (existing) return 0;
  const [users] = await c.query("SELECT user_id AS id,username FROM users");
  const idOf = Object.fromEntries(users.map((u) => [u.username, u.id]));
  let added = 0;
  const commentIds = [];
  for (const [
    index,
    [author, movie, commenter, text, parent],
  ] of demoComments.entries()) {
    if (!idOf[author] || !idOf[commenter]) continue;
    if (parent !== undefined && !commentIds[parent]) continue;
    const [[review]] = await c.execute(
      "SELECT review_id AS id FROM review WHERE user_id=? AND movie_id=?",
      [idOf[author], movie],
    );
    if (!review) continue;
    const [result] = await c.execute(
      "INSERT INTO review_comment(review_id,parent_comment_id,user_id,comment_text,create_date) VALUES(?,?,?,?,DATE_SUB(NOW(),INTERVAL ? MINUTE))",
      [
        review.id,
        parent === undefined ? null : commentIds[parent],
        idOf[commenter],
        text,
        60 - index * 5,
      ],
    );
    commentIds[index] = result.insertId;
    added++;
  }
  for (const [member, index] of demoCommentLikes)
    if (idOf[member] && commentIds[index])
      await c.execute(
        "INSERT INTO comment_like(user_id,comment_id) VALUES(?,?)",
        [idOf[member], commentIds[index]],
      );
  return added;
}

// Members added with the classic Hollywood films, with their reviews, follows and a list.
const classicMembers = ["eleanor", "theo", "rosa", "sam"];
const classicReviews = [
  [
    "eleanor",
    13,
    9.5,
    "Every line is a quotation now, but it still plays as if it were happening for the first time.",
  ],
  [
    "theo",
    20,
    9,
    "Hitchcock turns the audience into the neighbour with the binoculars. Perfectly paced.",
  ],
  [
    "rosa",
    15,
    9,
    "Audrey Hepburn on a Vespa is reason enough. The ending is braver than I remembered.",
  ],
  [
    "sam",
    14,
    9.5,
    "Pure joy from the first frame. The title number still feels impossible.",
  ],
  [
    "eleanor",
    18,
    8.5,
    "Sharp, sad and funny about the business of making films. Norma Desmond is unforgettable.",
  ],
  [
    "theo",
    16,
    9,
    "Dreamlike and unsettling. The colours alone tell the story.",
  ],
  [
    "sam",
    21,
    9.5,
    "Every scene has the weight of a family photograph. See it on the biggest screen you can find.",
  ],
  [
    "rosa",
    19,
    8,
    "Moon River, the opening shot, the cat in the rain. Style that never dates.",
  ],
  [
    "eleanor",
    22,
    9,
    "More than a Christmas film. A generous reminder of how much one life touches others.",
  ],
  [
    "theo",
    17,
    8.5,
    "Fast, silly and very clever. That final line still gets the biggest laugh.",
  ],
];
async function addClassicCircle(c) {
  const [taken] = await c.query(
    "SELECT username FROM users WHERE username IN (?)",
    [classicMembers],
  );
  if (taken.length) return 0;
  const hash = await hashPassword("Cinema2026!");
  const ids = {};
  for (const name of classicMembers) {
    const [result] = await c.execute(
      "INSERT INTO users(username,password_hash) VALUES(?,?)",
      [name, hash],
    );
    ids[name] = result.insertId;
    await c.execute("INSERT INTO user_email VALUES(?,?)", [
      ids[name],
      `${name}@cinecircle.local`,
    ]);
    await c.execute("INSERT INTO regular_user(user_id) VALUES(?)", [ids[name]]);
  }
  const reviewIds = [];
  // Dated before the original demo reviews, so the newest reviews stay on top.
  for (const [index, [name, movie, rating, text]] of classicReviews.entries()) {
    const [result] = await c.execute(
      "INSERT INTO review(user_id,movie_id,rating,review_text,create_date) VALUES(?,?,?,?,DATE_SUB(NOW(),INTERVAL ? HOUR))",
      [ids[name], movie, rating, text, 14 + index * 5],
    );
    reviewIds.push(result.insertId);
  }
  const [[mia]] = await c.query(
    "SELECT user_id AS id FROM users WHERE username='mia'",
  );
  const follows = [
    [ids.theo, ids.eleanor],
    [ids.rosa, ids.eleanor],
    [ids.sam, ids.theo],
    [ids.eleanor, ids.rosa],
  ];
  if (mia) follows.push([mia.id, ids.eleanor], [ids.eleanor, mia.id]);
  for (const pair of follows)
    await c.execute(
      "INSERT INTO follows(follower_id,followed_id) VALUES(?,?)",
      pair,
    );
  for (const [name, review] of [
    ["theo", 0],
    ["rosa", 0],
    ["eleanor", 3],
    ["sam", 1],
  ])
    await c.execute("INSERT INTO review_like(user_id,review_id) VALUES(?,?)", [
      ids[name],
      reviewIds[review],
    ]);
  await c.execute(
    "INSERT INTO film_list(user_id,list_id,list_name,description,visibility) VALUES(?,1,'Golden age Hollywood','Black and white, Technicolor and a few perfect endings.','public')",
    [ids.eleanor],
  );
  for (const [position, movie] of [13, 22, 18, 14, 15].entries())
    await c.execute("INSERT INTO film_list_movie VALUES(?,1,?,?)", [
      ids.eleanor,
      movie,
      position + 1,
    ]);
  await c.execute(
    "INSERT INTO wants_to_watch(user_id,movie_id) VALUES(?,16),(?,13)",
    [ids.rosa, ids.sam],
  );
  return classicMembers.length;
}

// Brings an older demo database up to the current catalogue: films and genres it lacks are
// added, then the classic members if none of them exist yet. Nothing existing is changed.
export async function extendCatalog(pool) {
  return transaction(pool, async (c) => {
    const [[{ movies }]] = await c.query(
      "SELECT COUNT(*) AS movies FROM movie",
    );
    if (!movies) return { films: 0, members: 0, halls: 0, comments: 0 };
    const [genreRows] = await c.query(
      "SELECT genre_id AS id, genre_name AS name FROM genre FOR UPDATE",
    );
    const genreIds = new Map(genreRows.map((g) => [g.name, g.id]));
    let nextGenre = Math.max(0, ...genreRows.map((g) => g.id)) + 1;
    const [existing] = await c.query("SELECT movie_id AS id FROM movie");
    const have = new Set(existing.map((m) => m.id));
    let added = 0;
    for (const f of films) {
      if (have.has(f.id)) continue;
      await c.execute("INSERT INTO movie VALUES(?,?,?,?,?,?)", [
        f.id,
        f.title,
        f.description,
        f.duration,
        `${f.year}-01-01`,
        f.language,
      ]);
      for (const genre of f.genres) {
        if (!genreIds.has(genre)) {
          await c.execute("INSERT INTO genre VALUES(?,?)", [nextGenre, genre]);
          genreIds.set(genre, nextGenre++);
        }
        await c.execute("INSERT INTO movie_genre VALUES(?,?)", [
          f.id,
          genreIds.get(genre),
        ]);
      }
      added++;
    }
    return {
      films: added,
      members: await addClassicCircle(c),
      halls: await updateSeatPlan(c),
      comments: await addDemoComments(c),
      bookmarks: await addDemoBookmarks(c),
    };
  });
}

// Keeps a long-lived database bookable: each of the next ten days without any screenings
// receives the standard schedule. Existing screenings and tickets are never changed.
export async function extendSchedule(pool) {
  return transaction(pool, async (c) => {
    const [halls] = await c.query(
      "SELECT cinema_id AS cinemaId,hall_id AS hallId FROM hall ORDER BY cinema_id,hall_id FOR UPDATE",
    );
    const [movies] = await c.query(
      "SELECT movie_id AS id,duration FROM movie ORDER BY movie_id",
    );
    if (!halls.length || !movies.length) return 0;
    const [scheduled] = await c.query(
      "SELECT DISTINCT DATEDIFF(start_time,CURRENT_DATE) AS day FROM screening WHERE start_time>=CURRENT_DATE",
    );
    const taken = new Set(scheduled.map((s) => Number(s.day)));
    let added = 0;
    for (let day = 1; day <= 10; day++) {
      if (taken.has(day)) continue;
      for (const [index, hall] of halls.entries())
        for (const hour of hours)
          await addScreening(
            c,
            null,
            movies[
              ((day - 1) * 3 + index * 2 + hours.indexOf(hour)) % movies.length
            ],
            hall.cinemaId,
            hall.hallId,
            day,
            hour,
          );
      added++;
    }
    return added;
  });
}

// Gives every film at least two screenings in the next ten days. Films short of that get a
// morning show that ends by 12:45, before the 13:00 screening, in a hall whose morning is
// free, so no screening overlaps another in the same hall.
export async function scheduleEveryFilm(pool, perFilm = 2) {
  return transaction(pool, async (c) => {
    const [halls] = await c.query(
      "SELECT cinema_id AS cinemaId,hall_id AS hallId FROM hall ORDER BY cinema_id,hall_id FOR UPDATE",
    );
    const [movies] = await c.query(
      `SELECT m.movie_id AS id,m.duration,
      (SELECT COUNT(*) FROM screening s WHERE s.movie_id=m.movie_id AND s.start_time>NOW()
        AND s.start_time<DATE_ADD(CURRENT_DATE,INTERVAL 11 DAY)) AS upcoming
      FROM movie m ORDER BY upcoming,m.movie_id`,
    );
    const [mornings] = await c.query(
      `SELECT DISTINCT DATEDIFF(start_time,CURRENT_DATE) AS day,cinema_id AS cinemaId,hall_id AS hallId
      FROM screening WHERE start_time>=CURRENT_DATE AND HOUR(start_time)<13`,
    );
    const used = new Set(
      mornings.map((m) => `${m.day}/${m.cinemaId}/${m.hallId}`),
    );
    const free = [];
    for (let day = 1; day <= 10; day++)
      for (const hall of halls)
        if (!used.has(`${day}/${hall.cinemaId}/${hall.hallId}`))
          free.push({ day, ...hall });
    let added = 0;
    for (const film of movies) {
      const latest = 12 * 60 + 45 - film.duration;
      if (latest < 9 * 60) continue;
      const start = Math.floor(latest / 15) * 15;
      const time = `${String(Math.floor(start / 60)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
      const days = new Set();
      for (let need = perFilm - Number(film.upcoming); need > 0; need--) {
        const slot = free.findIndex((f) => !days.has(f.day));
        if (slot < 0) break;
        const [{ day, cinemaId, hallId }] = free.splice(slot, 1);
        days.add(day);
        await addScreening(c, null, film, cinemaId, hallId, day, time);
        added++;
      }
    }
    return added;
  });
}

// Keeps the programme current: fills empty days, then makes sure every film is showing.
export async function refreshSchedule(pool) {
  const days = await extendSchedule(pool);
  return { days, showings: await scheduleEveryFilm(pool) };
}

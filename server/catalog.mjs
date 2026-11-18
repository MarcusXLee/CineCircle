// Presentation metadata only. Movie titles, synopses, ratings, social data and tickets are read from MySQL.
export const films = [
  {
    id: 1,
    title: "In the Mood for Love",
    year: 2000,
    duration: 99,
    language: "Cantonese",
    director: "Wong Kar-wai",
    genres: ["Romance", "Drama"],
    color: "#743a2d",
    poster: "iYypPT4bhqXfq1b6EnmxvRt6b2Y.jpg",
    description:
      "Hong Kong, 1962. Two neighbours discover a quiet connection in the spaces between chance encounters. A story of longing, restraint, and the moments that stay with us.",
  },
  {
    id: 2,
    title: "The Grand Budapest Hotel",
    year: 2014,
    duration: 100,
    language: "English",
    director: "Wes Anderson",
    genres: ["Comedy", "Adventure"],
    color: "#af7e93",
    poster: "eWdyYQreja6JGCzqHWXpWHDrrPo.jpg",
    description:
      "A legendary concierge and his trusted lobby boy become unlikely friends in a beautifully eccentric hotel, on the eve of a changing Europe.",
  },
  {
    id: 3,
    title: "Perfect Days",
    year: 2023,
    duration: 124,
    language: "Japanese",
    director: "Wim Wenders",
    genres: ["Drama"],
    color: "#66807e",
    poster: "aIkGJbGq4q3vBgAOTY92uE0DRe9.jpg",
    description:
      "Hirayama finds beauty in Tokyo’s ordinary days: morning light, cassette tapes, books, and the people whose paths cross his own.",
  },
  {
    id: 4,
    title: "Past Lives",
    year: 2023,
    duration: 106,
    language: "Korean",
    director: "Celine Song",
    genres: ["Romance", "Drama"],
    color: "#7b8974",
    poster: "k3waqVXSnvCZWfJYNtdamTgTtTA.jpg",
    description:
      "Childhood friends Nora and Hae Sung reunite in New York after decades apart, wondering about the lives they might have shared.",
  },
  {
    id: 5,
    title: "Aftersun",
    year: 2022,
    duration: 102,
    language: "English",
    director: "Charlotte Wells",
    genres: ["Drama"],
    color: "#7c9da2",
    poster: "y89Ht2wewMgeEWqJ5EL8PDkdkvk.jpg",
    description:
      "Years after a holiday in Turkey, Sophie returns to the fragments of a summer spent with her father, searching for the person beyond her memories.",
  },
  {
    id: 6,
    title: "Spirited Away",
    year: 2001,
    duration: 125,
    language: "Japanese",
    director: "Hayao Miyazaki",
    genres: ["Animation", "Fantasy"],
    color: "#668478",
    poster: "39wmItIWsg5sZMyRUHLkWBcuVCM.jpg",
    description:
      "Chihiro steps into a world of spirits and impossible wonders, and must find the courage to bring her family home.",
  },
  {
    id: 7,
    title: "Interstellar",
    year: 2014,
    duration: 169,
    language: "English",
    director: "Christopher Nolan",
    genres: ["Sci-fi", "Adventure"],
    color: "#697a85",
    poster: "gEU2QniE6E77NI6lCU6MxlNBvIx2.jpg",
    description:
      "A pilot joins a mission beyond our solar system, carrying the hope of humanity and a promise to his daughter across time and space.",
  },
  {
    id: 8,
    title: "Dune: Part Two",
    year: 2024,
    duration: 166,
    language: "English",
    director: "Denis Villeneuve",
    genres: ["Sci-fi", "Adventure"],
    color: "#ae7149",
    poster: "1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg",
    description:
      "On the desert planet Arrakis, Paul Atreides joins the Fremen and faces a choice between love and the future he has foreseen.",
  },
  {
    id: 9,
    title: "Everything Everywhere All at Once",
    year: 2022,
    duration: 139,
    language: "English",
    director: "Daniel Kwan & Daniel Scheinert",
    genres: ["Sci-fi", "Comedy"],
    color: "#bf9b8d",
    poster: "w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg",
    description:
      "An exhausted laundromat owner discovers that the key to saving the multiverse might lie in the small, messy details of her own family.",
  },
  {
    id: 10,
    title: "La La Land",
    year: 2016,
    duration: 128,
    language: "English",
    director: "Damien Chazelle",
    genres: ["Romance", "Music"],
    color: "#77739b",
    poster: "uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg",
    description:
      "An actress and a jazz pianist follow their dreams through Los Angeles, finding love in a city that asks them to keep reaching.",
  },
  {
    id: 11,
    title: "Arrival",
    year: 2016,
    duration: 116,
    language: "English",
    director: "Denis Villeneuve",
    genres: ["Sci-fi", "Drama"],
    color: "#8d9791",
    poster: "x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg",
    description:
      "When mysterious spacecraft arrive on Earth, a linguist searches for a shared language and discovers a different way to understand time.",
  },
  {
    id: 12,
    title: "Portrait of a Lady on Fire",
    year: 2019,
    duration: 122,
    language: "French",
    director: "Céline Sciamma",
    genres: ["Romance", "Drama"],
    color: "#798572",
    poster: "2LquGwEhbg3soxSCs9VNyh5VJd9.jpg",
    description:
      "On an isolated island in Brittany, a painter observes her subject in secret. In time, observation becomes an unforgettable act of seeing.",
  },
  // Classic Hollywood additions (2026-11-18).
  {
    id: 13,
    title: "Casablanca",
    year: 1942,
    duration: 102,
    language: "English",
    director: "Michael Curtiz",
    genres: ["Romance", "Drama"],
    color: "#6a6a6b",
    poster: "lGCEKlJo2CnWydQj7aamY7s1S7Q.jpg",
    description:
      "In wartime Morocco, a cynical nightclub owner is asked to help the woman he once loved escape with her husband, and must decide what one man’s heart is worth.",
  },
  {
    id: 14,
    title: "Singin' in the Rain",
    year: 1952,
    duration: 103,
    language: "English",
    director: "Stanley Donen & Gene Kelly",
    genres: ["Music", "Comedy"],
    color: "#5f7775",
    poster: "zjrpWniKbzu0zFR5sUI1Ptdfl9y.jpg",
    description:
      "As Hollywood learns to talk, a silent-film star, his best friend and a bright young singer dance their way through the chaos of the first musicals.",
  },
  {
    id: 15,
    title: "Roman Holiday",
    year: 1953,
    duration: 118,
    language: "English",
    director: "William Wyler",
    genres: ["Romance", "Comedy"],
    color: "#8d7248",
    poster: "8lI9dmz1RH20FAqltkGelY1v4BE.jpg",
    description:
      "A young princess slips away from her royal duties and spends one unforgettable day in Rome with an American reporter who knows exactly who she is.",
  },
  {
    id: 16,
    title: "Vertigo",
    year: 1958,
    duration: 128,
    language: "English",
    director: "Alfred Hitchcock",
    genres: ["Thriller", "Romance"],
    color: "#8d5448",
    poster: "15uOEfqBNTVtDUT7hGBVCka0rZz.jpg",
    description:
      "A retired detective with a fear of heights is hired to follow a friend’s wife through San Francisco, and falls into an obsession he cannot escape.",
  },
  {
    id: 17,
    title: "Some Like It Hot",
    year: 1959,
    duration: 121,
    language: "English",
    director: "Billy Wilder",
    genres: ["Comedy", "Romance"],
    color: "#7a765c",
    poster: "hVIKyTK13AvOGv7ICmJjK44DTzp.jpg",
    description:
      "Two musicians who witness a gangland killing hide in an all-female band bound for Florida, where staying in disguise gets harder by the day.",
  },
  {
    id: 18,
    title: "Sunset Boulevard",
    year: 1950,
    duration: 110,
    language: "English",
    director: "Billy Wilder",
    genres: ["Drama", "Thriller"],
    color: "#8d5348",
    poster: "zt8aQ6ksqK6p1AopC5zVTDS9pKT.jpg",
    description:
      "A struggling screenwriter takes refuge in the decaying mansion of a forgotten silent-film star who is planning her return to the pictures.",
  },
  {
    id: 19,
    title: "Breakfast at Tiffany's",
    year: 1961,
    duration: 115,
    language: "English",
    director: "Blake Edwards",
    genres: ["Romance", "Comedy"],
    color: "#885d4d",
    poster: "79xm4gXw4l7A5D0XukUOJRocFYQ.jpg",
    description:
      "In Manhattan, the free-spirited Holly Golightly and her new neighbour, a young writer, discover that the life she has invented leaves little room for love.",
  },
  {
    id: 20,
    title: "Rear Window",
    year: 1954,
    duration: 112,
    language: "English",
    director: "Alfred Hitchcock",
    genres: ["Thriller"],
    color: "#8d5e48",
    poster: "ILVF0eJxHMddjxeQhswFtpMtqx.jpg",
    description:
      "Confined to his apartment with a broken leg, a photographer watches his neighbours through the window and becomes convinced one of them has committed murder.",
  },
  {
    id: 21,
    title: "The Godfather",
    year: 1972,
    duration: 175,
    language: "English",
    director: "Francis Ford Coppola",
    genres: ["Crime", "Drama"],
    color: "#77625f",
    poster: "3bhkrj58Vtu7enYsRolD1fZdja1.jpg",
    description:
      "The ageing head of a New York crime family hands his empire to his reluctant youngest son, who discovers how far he will go to protect it.",
  },
  {
    id: 22,
    title: "It's a Wonderful Life",
    year: 1946,
    duration: 130,
    language: "English",
    director: "Frank Capra",
    genres: ["Drama", "Fantasy"],
    color: "#7e6457",
    poster: "bSqt9rhDZx1Q7UZ86dBPKdNomp2.jpg",
    description:
      "On Christmas Eve, a despairing man is shown by his guardian angel how different his town would be if he had never been born.",
  },
];
export const presentation = (movie) => {
  const meta = films.find((f) => f.id === movie.movieId);
  return {
    ...movie,
    year: Number(String(movie.releaseDate || "").slice(0, 4)) || meta?.year,
    director: meta?.director || "",
    poster: `/images/poster-${meta?.id || 1}.jpg`,
    color: meta?.color || "#53746a",
    genres:
      typeof movie.genres === "string"
        ? movie.genres.split("|").filter(Boolean)
        : movie.genres || [],
  };
};
// Schema v1 has no pricing columns. These explicit local-demo policies supply pre-booking prices.
export const pricingPolicy = {
  evening: 98,
  matinee: 78,
  premiumSeatExtra: 25,
  currency: "HKD",
};
export function basePrice(screening, seat) {
  const hour = Number(String(screening.startTime).slice(11, 13));
  return (
    (hour < 17 ? pricingPolicy.matinee : pricingPolicy.evening) +
    (seat.type === "premium" ? pricingPolicy.premiumSeatExtra : 0)
  );
}
export const movieSelect = `SELECT m.movie_id AS movieId, m.title, m.description, m.duration, m.release_date AS releaseDate, m.language,
  (SELECT GROUP_CONCAT(g.genre_name ORDER BY g.genre_id SEPARATOR '|') FROM movie_genre mg JOIN genre g USING(genre_id) WHERE mg.movie_id=m.movie_id) AS genres,
  (SELECT ROUND(AVG(r.rating),1) FROM review r WHERE r.movie_id=m.movie_id) AS rating,
  (SELECT COUNT(*) FROM review r WHERE r.movie_id=m.movie_id) AS reviewCount
  FROM movie m`;

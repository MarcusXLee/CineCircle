// The programme supplies artwork. Titles, ratings, runtimes and showtimes come from the API.
export const filmPrints = [
  {
    title: "The Grand Budapest Hotel",
    image: "/images/hero.webp",
    alt: "The pink Grand Budapest Hotel against the snowy mountains",
    paper: "#f2cbd4",
    ink: "#431d34",
    focus: "50% 55%",
    scale: 1.34,
  },
  {
    title: "In the Mood for Love",
    image: "/images/spotlight-mood.jpg",
    alt: "Su Li-zhen at the far end of a corridor lined with red curtains",
    paper: "#77293b",
    ink: "#fff1db",
    focus: "74% 50%",
    scale: 1,
  },
  {
    title: "Spirited Away",
    image: "/images/spotlight-spirited.jpg",
    alt: "Chihiro and No-Face riding a train across the water",
    paper: "#c0dce6",
    ink: "#213f51",
    focus: "53% 51%",
    scale: 1,
  },
  {
    title: "Casablanca",
    image: "/images/spotlight-casablanca.jpg",
    alt: "Rick Blaine in a white dinner jacket above the crowd at Rick’s Café",
    paper: "#c9c6c0",
    ink: "#1f2126",
    focus: "38% 30%",
    scale: 1,
  },
  {
    title: "Rear Window",
    image: "/images/spotlight-rear-window.jpg",
    alt: "Lisa in a black dress while Jeff watches the courtyard through binoculars",
    paper: "#d9b9a6",
    ink: "#2d1d18",
    focus: "60% 35%",
    scale: 1,
  },
  {
    title: "Roman Holiday",
    image: "/images/spotlight-roman-holiday.jpg",
    alt: "Princess Ann and Joe ride a scooter past the Spanish Steps in Rome",
    paper: "#e2c8a8",
    ink: "#3a2a1c",
    focus: "70% 50%",
    scale: 1,
  },
  {
    title: "Singin' in the Rain",
    image: "/images/spotlight-singin.jpg",
    alt: "Don Lockwood in a yellow raincoat swinging an umbrella in the rain",
    paper: "#a9cfe0",
    ink: "#13303d",
    focus: "45% 40%",
    scale: 1,
  },
];

export function printFor(title) {
  return filmPrints.find((print) => print.title === title);
}

// Films shown in the home page spotlight, in order. Each has a still above.
export const spotlightTitles = [
  "Casablanca",
  "The Grand Budapest Hotel",
  "Rear Window",
  "In the Mood for Love",
  "Singin' in the Rain",
  "Roman Holiday",
];

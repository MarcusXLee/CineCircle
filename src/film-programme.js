// The programme supplies artwork. Titles, ratings, runtimes and showtimes come from the API.
// `focus` crops the still for the film page header. In the home spotlight, `side` is where
// the text goes (the side of the still without its people; left unless given) and `frameX`
// is which part of the still stays in view when the frame is narrower than 16:9. Optional:
// `titleScale` and `lift` tune a film's title size and height; `quote` adds a line from the
// film itself, credited to the character who says it.
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
    frameX: "100%",
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
    side: "right",
    frameX: "100%",
    titleScale: 1.14,
    lift: "24px",
    focus: "38% 30%",
    scale: 1,
  },
  {
    title: "Rear Window",
    image: "/images/spotlight-rear-window.jpg",
    alt: "Jeff in his dim apartment, holding his camera with its long lens",
    paper: "#cccab6",
    ink: "#2e2d23",
    frameX: "100%",
    focus: "70% 30%",
    scale: 1,
  },
  {
    title: "La La Land",
    image: "/images/spotlight-la-la-land.jpg",
    alt: "Mia and Sebastian dancing above the lights of Los Angeles at dusk",
    paper: "#aaa6dd",
    ink: "#1a1839",
    frameX: "50%",
    quote: { line: "Here’s to the fools who dream.", by: "Mia Dolan" },
    focus: "70% 70%",
    scale: 1,
  },
  {
    title: "Roman Holiday",
    image: "/images/spotlight-roman-holiday.jpg",
    alt: "Princess Ann and Joe ride a scooter past the Spanish Steps in Rome",
    paper: "#e2c8a8",
    ink: "#3a2a1c",
    frameX: "50%",
    titleScale: 1.06,
    lift: "24px",
    focus: "70% 50%",
    scale: 1,
  },
  {
    title: "Singin' in the Rain",
    image: "/images/spotlight-singin.jpg",
    alt: "Don Lockwood in a yellow raincoat swinging an umbrella in the rain",
    paper: "#a9cfe0",
    ink: "#13303d",
    side: "right",
    frameX: "100%",
    focus: "45% 40%",
    scale: 1,
  },
];

export function printFor(title) {
  return filmPrints.find((print) => print.title === title);
}

// Films shown in the home page spotlight, in order. Each has a still above.
// Each still leaves one side calm for the text to fade into.
export const spotlightTitles = [
  "Casablanca",
  "Rear Window",
  "In the Mood for Love",
  "Singin' in the Rain",
  "Roman Holiday",
  "La La Land",
];

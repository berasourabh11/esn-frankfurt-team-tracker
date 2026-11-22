import { slugify } from "@/lib/utils";
import type { EsnEventInput } from "@/types/event";

/**
 * Mock event data curated from the ESN Frankfurt planning sheet
 * ("Events ESN FFM.xlsx", June 2026 – February 2027).
 *
 * Only public information is kept. The sheet's organiser (OC) names,
 * budgets, guest-list instructions, internal calls, team-only trips and
 * events of other ESN sections listed in the notes row were deliberately
 * left out. Times and locations come from the notes when they were given;
 * otherwise they are omitted and the UI shows "Time to be announced".
 *
 * Entries whose title ended with "?" in the sheet are marked `tentative`.
 * The "💃" (mostly Wednesdays) and "🏃‍♂️" (Sundays) placeholders are interpreted as
 * the weekly dance night and Sunday run.
 *
 * This file mirrors the payload the Spring Boot API is expected to return.
 */

type Seed = Omit<EsnEventInput, "id" | "slug" | "summary" | "description"> & {
  summary: string;
  description?: string;
};

function seed(input: Seed): EsnEventInput {
  const slug = `${slugify(input.title)}-${input.startDate}`;
  return {
    ...input,
    id: slug,
    slug,
    description: input.description ?? input.summary,
  };
}

const DANCE_NIGHT_DATES = [
  "2026-06-17",
  "2026-06-24",
  "2026-07-01",
  "2026-07-08",
  "2026-07-15",
  "2026-07-29",
  "2026-08-05",
  "2026-08-19",
  "2026-08-26",
  "2026-09-02",
  "2026-09-16",
  "2026-09-23",
  "2026-09-30",
  "2026-10-14",
  "2026-10-21",
  "2026-10-28",
  "2026-11-04",
  "2026-11-11",
  "2026-11-18",
  "2026-11-25",
  "2026-12-02",
  "2026-12-03",
  "2026-12-09",
  "2026-12-16",
  "2026-12-23",
  "2026-12-30",
  "2027-01-06",
  "2027-01-13",
  "2027-01-20",
  "2027-01-27",
  "2027-02-03",
  "2027-02-10",
  "2027-02-17",
];

const danceNights = DANCE_NIGHT_DATES.map((date) =>
  seed({
    title: "Dance Night 💃",
    category: "social",
    startDate: date,
    summary: "Our regular dance meetup — come along, no partner or experience needed.",
    description:
      "Dance Night is one of ESN Frankfurt's regular meetups. Join other international students on the dance floor — no partner or previous experience needed. Details are shared in the ESN Frankfurt channels.",
    tags: ["weekly", "dance"],
  }),
);

const sundayRuns = ["2026-06-21", "2026-06-28", "2026-07-05", "2026-09-06"].map((date) =>
  seed({
    title: "Sunday Run 🏃",
    category: "sports",
    startDate: date,
    summary: "An easy-going group run to start the week fresh. All paces welcome.",
    description:
      "A relaxed group run with the ESN Frankfurt community. All paces are welcome — the point is to move, chat and meet new people.",
    tags: ["running"],
  }),
);

function stammtisch(date: string, venue?: string, extra: Partial<Seed> = {}) {
  return seed({
    title: venue ? `Stammtisch at ${venue}` : "Stammtisch",
    category: "social",
    startDate: date,
    location: venue,
    summary:
      "Our weekly Monday get-together. Grab a drink, meet other internationals and the ESN team.",
    description:
      "The Stammtisch is ESN Frankfurt's weekly Monday meetup — the easiest way to meet other international students, ask the ESN team questions and make plans for the week. Everyone is welcome, whether it's your first week or your last.",
    tags: ["weekly", "stammtisch"],
    ...extra,
  });
}

function danceClass(
  title: "Afro Dance Class" | "Dancehall Class",
  date: string,
  startTime: string,
  endTime: string,
  location: string,
) {
  return seed({
    title,
    category: "workshops",
    startDate: date,
    startTime,
    endTime,
    location,
    summary: `Learn the basics of ${title === "Afro Dance Class" ? "Afro dance" : "dancehall"} in a friendly beginner class.`,
    description: `A beginner-friendly ${title === "Afro Dance Class" ? "Afro dance" : "dancehall"} class. No experience needed — wear comfortable clothes and bring water.`,
    tags: ["dance", "class"],
  });
}

const curated: EsnEventInput[] = [
  // ── June 2026 ──────────────────────────────────────────────────────────
  stammtisch("2026-06-15", "Kiosk Westend"),
  seed({
    title: "Padel & Swimming Pool",
    category: "sports",
    startDate: "2026-06-16",
    summary: "A sporty summer afternoon: a few rounds of padel followed by a dip in the pool.",
  }),
  seed({
    title: "Concert at Mehr",
    category: "cultural",
    startDate: "2026-06-18",
    summary: "Live music night together with the ESN Frankfurt crew.",
  }),
  seed({
    title: "Langener Waldsee",
    category: "trips",
    startDate: "2026-06-19",
    startTime: "16:00",
    location: "Langener Waldsee",
    summary: "Summer afternoon at the lake with music, snacks and drinks.",
    description:
      "Escape the city heat at Langener Waldsee, one of the most popular lakes near Frankfurt. We'll bring a music box, snacks and drinks — you bring your swimwear and good mood.",
  }),
  seed({
    title: "Aschaffenburg Volksfest",
    category: "trips",
    startDate: "2026-06-20",
    location: "Aschaffenburg",
    priceInfo: "€15",
    summary: "Day out at the Aschaffenburg folk festival — rides, food and Bavarian fun.",
  }),
  seed({
    title: "Koblenz Day Trip",
    category: "trips",
    startDate: "2026-06-21",
    location: "Koblenz",
    summary: "Explore Koblenz, where the Rhine meets the Moselle.",
  }),
  stammtisch("2026-06-22", undefined, {
    summary: "Our weekly Monday get-together. Venue to be announced.",
  }),
  seed({
    title: "Murder Mysteries",
    category: "social",
    startDate: "2026-06-23",
    summary: "Solve a crime together in an evening of role play and detective work.",
  }),
  seed({
    title: "Gala Night",
    category: "parties",
    startDate: "2026-06-26",
    summary: "Dress up for an elegant evening with the ESN community.",
  }),
  seed({
    title: "Sitsits in Darmstadt",
    category: "cultural",
    startDate: "2026-06-27",
    location: "Darmstadt",
    summary: "A Nordic-style singing dinner party with a three-course meal and games.",
    description:
      "Sitsits is a Nordic student tradition: a themed dinner party all about singing, with a three-course meal followed by fun games. Anyone can start a song and introduce themselves — don't be shy!",
  }),
  seed({
    title: "Picnic at Osthafenpark",
    category: "social",
    startDate: "2026-06-28",
    location: "Osthafenpark",
    summary: "Relaxed summer picnic by the river. Bring something to share.",
  }),
  stammtisch("2026-06-29", "Kiosk Westend"),
  seed({
    title: "Volleyball",
    category: "sports",
    startDate: "2026-06-30",
    summary: "Evening volleyball session — all levels welcome. Start time to be announced.",
  }),

  // ── July 2026 ──────────────────────────────────────────────────────────
  stammtisch("2026-07-06", "Main Café"),
  seed({
    title: "CSD Frankfurt",
    category: "cultural",
    startDate: "2026-07-17",
    location: "Frankfurt am Main",
    summary: "Join ESN Frankfurt at Christopher Street Day to celebrate Pride together.",
  }),
  seed({
    title: "Miramar Trip",
    category: "trips",
    startDate: "2026-07-19",
    location: "Miramar, Weinheim",
    summary: "A day of slides, pools and sauna at the Miramar leisure pool.",
  }),
  stammtisch("2026-07-20", "Main Café"),
  seed({
    title: "Bachata Party 💃",
    category: "parties",
    startDate: "2026-07-22",
    summary: "A special edition of Dance Night dedicated to bachata.",
  }),
  stammtisch("2026-07-27", "Kiosk Westend"),

  // ── August 2026 ────────────────────────────────────────────────────────
  stammtisch("2026-08-03", "Main Café"),
  seed({
    title: "Semester Closing Party",
    category: "parties",
    startDate: "2026-08-08",
    summary: "Celebrate the end of the semester with one last big party.",
  }),
  stammtisch("2026-08-10", "Kiosk Westend"),
  stammtisch("2026-08-17", "Main Café"),
  seed({
    title: "Introduction for Frankfurt School Students",
    category: "other",
    startDate: "2026-08-20",
    startTime: "10:45",
    endTime: "11:00",
    summary: "A short introduction to ESN Frankfurt for newly arrived Frankfurt School students.",
  }),
  stammtisch("2026-08-24", "Kiosk Westend"),
  stammtisch("2026-08-31", "Main Café"),

  // ── September 2026: Welcome Week ───────────────────────────────────────
  seed({
    title: "Welcome Week: Kiosk Crawl",
    category: "parties",
    startDate: "2026-09-04",
    startTime: "18:00",
    endTime: "23:00",
    summary: "Discover Frankfurt's legendary Kiosk culture with icebreakers along the way.",
    description:
      "Frankfurt's kiosks ('Wasserhäuschen') are a local institution. We'll hop between some of the best ones, with icebreaker games so you meet lots of new people on the way.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: City Rallye",
    category: "social",
    startDate: "2026-09-05",
    startTime: "17:00",
    location: "Seminarhaus",
    summary: "Team up and explore Frankfurt in a city rallye full of challenges.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Castle Hike in Königstein",
    category: "sports",
    startDate: "2026-09-06",
    location: "Königstein im Taunus",
    summary: "An easy, roughly three-hour hike past three different castles in the Taunus.",
    tags: ["welcome-week", "hiking"],
  }),
  seed({
    title: "Welcome Week: Stammtisch at Shots",
    category: "social",
    startDate: "2026-09-07",
    location: "Shots",
    summary: "Welcome shots and ESN cards available at the entrance.",
    tags: ["welcome-week", "stammtisch"],
  }),
  seed({
    title: "Welcome Week: Game Night",
    category: "social",
    startDate: "2026-09-08",
    startTime: "19:00",
    endTime: "22:00",
    location: "AMKA",
    summary: "Board games, card games and good company. Feel free to bring your favourite game.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Speed Friending",
    category: "social",
    startDate: "2026-09-09",
    startTime: "19:00",
    location: "Seminarhaus",
    summary: "Meet a lot of new people in very little time — speed dating, but for friends.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Padel Tennis",
    category: "sports",
    startDate: "2026-09-10",
    startTime: "18:00",
    endTime: "20:00",
    location: "Hockey Factory Karben",
    priceInfo: "€14.50 with ESN card · €15.50 without",
    summary: "Try padel, the fastest-growing racket sport. Limited to 12 participants.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Farid Party",
    category: "parties",
    startDate: "2026-09-11",
    summary: "Welcome Week party night.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Palmengarten",
    category: "cultural",
    startDate: "2026-09-12",
    startTime: "14:00",
    location: "Palmengarten",
    summary: "Visit Frankfurt's beautiful botanical garden together.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: International Dinner",
    category: "cultural",
    startDate: "2026-09-13",
    location: "Grüneburgpark",
    summary: "Picnic-style dinner with food from around the world. Bring your own food and drinks.",
    tags: ["welcome-week"],
  }),
  stammtisch("2026-09-14", "Café Plazz"),
  seed({
    title: "German Practice",
    category: "workshops",
    startDate: "2026-09-15",
    startTime: "18:00",
    location: "Seminarhaus",
    summary: "Practise your German in a relaxed, judgement-free setting.",
  }),
  seed({
    title: "Chess Evening",
    category: "social",
    startDate: "2026-09-17",
    location: "Seminarhaus",
    summary: "Casual chess for beginners and grandmasters alike.",
  }),
  seed({
    title: "Darmstadt Visit",
    category: "trips",
    startDate: "2026-09-19",
    location: "Darmstadt",
    summary: "Explore the nearby science city of Darmstadt together.",
  }),
  seed({
    title: "Crochet Gathering",
    category: "workshops",
    startDate: "2026-09-20",
    summary: "Bring your yarn (or learn from scratch) and crochet in good company.",
  }),
  stammtisch("2026-09-21", "Waxy's"),
  seed({
    title: "Bouldering",
    category: "sports",
    startDate: "2026-09-24",
    summary: "Climb, fall, laugh and try again. Beginners very welcome. Time to be announced.",
  }),
  seed({
    title: "Cannstatter Wasen Trip",
    category: "trips",
    startDate: "2026-09-27",
    location: "Stuttgart",
    summary: "Trip to Stuttgart's famous Wasen beer festival.",
  }),

  // ── October 2026: second Welcome Week ──────────────────────────────────
  seed({
    title: "Welcome Week: Kiosk Crawl",
    category: "parties",
    startDate: "2026-10-02",
    summary: "Discover Frankfurt's kiosk culture and meet fellow newcomers.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: University Rallye",
    category: "social",
    startDate: "2026-10-03",
    summary: "Get to know the campus and your fellow students in a team rallye.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Marburg Trip",
    category: "trips",
    startDate: "2026-10-04",
    location: "Marburg",
    summary: "Day trip to the charming university town of Marburg.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Stammtisch at Shots",
    category: "social",
    startDate: "2026-10-05",
    location: "Shots",
    summary: "The Welcome Week edition of our Monday Stammtisch.",
    tags: ["welcome-week", "stammtisch"],
  }),
  seed({
    title: "Welcome Week: Game Night",
    category: "social",
    startDate: "2026-10-06",
    summary: "Board games, card games and good company.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Flunky Ball Tournament",
    category: "sports",
    startDate: "2026-10-07",
    summary: "Germany's favourite outdoor team game. Form a team or join one on the spot.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Karaoke",
    category: "parties",
    startDate: "2026-10-08",
    summary: "Grab the mic and sing your heart out.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Big Pregaming",
    category: "parties",
    startDate: "2026-10-09",
    summary: "Warm up together before heading out for the night.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Welcome Week: Crime Mystery Night",
    category: "social",
    startDate: "2026-10-10",
    summary: "Put on your detective hat for an evening of crime-solving fun.",
    tags: ["welcome-week"],
  }),
  seed({
    title: "Cochem Day Trip",
    category: "trips",
    startDate: "2026-10-11",
    location: "Cochem",
    summary: "Castles, vineyards and the Moselle valley on a day trip to Cochem.",
  }),
  stammtisch("2026-10-12", "Waxy's"),
  seed({
    title: "International Dinner (DAAD Erasmus Days)",
    category: "cultural",
    startDate: "2026-10-17",
    summary: "Share dishes from your home country as part of the Erasmus Days.",
  }),
  seed({
    title: "Lasertag",
    category: "sports",
    startDate: "2026-10-18",
    summary: "Team up for a high-energy round of laser tag.",
  }),
  seed({
    title: "Silent Reading 📖",
    category: "cultural",
    startDate: "2026-10-20",
    summary: "Bring a book and enjoy a cosy, quiet reading session with others.",
  }),
  seed({
    title: "Frankfurt Skyliners Basketball",
    category: "sports",
    startDate: "2026-10-21",
    location: "Frankfurt",
    summary: "Cheer on Frankfurt's basketball team together.",
  }),
  seed({
    title: "Possmann Cider Visit",
    category: "cultural",
    startDate: "2026-10-23",
    startTime: "16:00",
    location: "Possmann",
    summary: "Discover Frankfurt's apple wine tradition at the Possmann cider house.",
  }),
  seed({
    title: "Dutch Culture Night",
    category: "cultural",
    startDate: "2026-10-24",
    summary: "An evening celebrating Dutch food, games and traditions.",
  }),
  seed({
    title: "Handcraft Gathering",
    category: "workshops",
    startDate: "2026-10-25",
    startTime: "15:00",
    summary: "Get creative with crafts in a relaxed Sunday afternoon session.",
  }),
  stammtisch("2026-10-26"),
  seed({
    title: "Kuduro Dance Workshop",
    category: "workshops",
    startDate: "2026-10-27",
    startTime: "18:00",
    summary: "Learn the energetic Angolan dance style Kuduro.",
  }),
  seed({
    title: "Halloween Party",
    category: "parties",
    startDate: "2026-10-30",
    location: "Café KoZ",
    summary: "Costumes on! ESN Frankfurt's spookiest party of the year.",
  }),

  // ── November 2026 ──────────────────────────────────────────────────────
  seed({
    title: "Halloween Hike",
    category: "sports",
    startDate: "2026-11-01",
    summary: "Shake off the Halloween party with an autumn hike.",
  }),
  stammtisch("2026-11-02"),
  seed({
    title: "Hochheimer Markt",
    category: "cultural",
    startDate: "2026-11-06",
    location: "Hochheim am Main",
    summary: "Visit one of the region's oldest and biggest traditional markets.",
  }),
  seed({
    title: "Padel Event",
    category: "sports",
    startDate: "2026-11-07",
    summary: "Another round of padel — beginners welcome.",
  }),
  stammtisch("2026-11-09", "Waxy's"),
  seed({
    title: "Language Café",
    category: "workshops",
    startDate: "2026-11-12",
    summary: "Practise languages over coffee and meet people from all over the world.",
  }),
  seed({
    title: "Spreebreak Berlin",
    category: "trips",
    startDate: "2026-11-12",
    endDate: "2026-11-15",
    location: "Berlin",
    summary: "Four days in Berlin with ESN students from all over Germany.",
    description:
      "Spreebreak is a multi-day trip to Berlin with international students from across Germany. Expect sightseeing, culture and plenty of parties. Public transport to Berlin is needed.",
  }),
  stammtisch("2026-11-16", "City Alm"),
  seed({
    title: "Frankfurt Skyliners Basketball",
    category: "sports",
    startDate: "2026-11-18",
    location: "Frankfurt",
    summary: "Cheer on Frankfurt's basketball team together.",
  }),
  danceClass("Afro Dance Class", "2026-11-19", "18:00", "20:00", "SH Campus"),
  seed({
    title: "CriminaLP",
    category: "social",
    startDate: "2026-11-20",
    endDate: "2026-11-22",
    location: "Frankfurt",
    summary: "A crime-themed weekend: kiosk crawl, party night and a murder mystery.",
    description:
      "CriminaLP is a crime-themed weekend with three events: a kiosk crawl through the Bahnhofsviertel, a party night with a cosy board-game alternative, and a murder mystery evening. Join one night or all three; each has its own page with the details.",
    tags: ["criminalp"],
  }),
  seed({
    title: "CriminaLP: Kiosk Crawl",
    category: "parties",
    startDate: "2026-11-20",
    location: "Bahnhofsviertel",
    summary: "Have fun around the old streets near the Hauptbahnhof on a kiosk crawl.",
    tags: ["criminalp"],
    parentSlug: "criminalp-2026-11-20",
  }),
  seed({
    title: "CriminaLP: Party & Cozy Board Games",
    category: "parties",
    status: "tentative",
    startDate: "2026-11-21",
    summary: "Party night with a cosy board-game alternative. Plans still being confirmed.",
    tags: ["criminalp"],
    parentSlug: "criminalp-2026-11-20",
  }),
  seed({
    title: "CriminaLP: Murder Mystery",
    category: "social",
    startDate: "2026-11-22",
    summary: "Solve the case in our murder mystery evening. Dressing up is encouraged!",
    tags: ["criminalp"],
    parentSlug: "criminalp-2026-11-20",
  }),
  stammtisch("2026-11-23"),
  seed({
    title: "Ice Skating",
    category: "sports",
    startDate: "2026-11-26",
    summary: "Lace up your skates for a winter evening on the ice.",
  }),
  seed({
    title: "Strasbourg Day Trip",
    category: "trips",
    startDate: "2026-11-29",
    location: "Strasbourg, France",
    summary: "Visit Strasbourg and its famous Christmas market just across the border.",
  }),
  stammtisch("2026-11-30"),

  // ── December 2026 ──────────────────────────────────────────────────────
  danceClass("Afro Dance Class", "2026-12-01", "18:30", "20:30", "AMKA"),
  seed({
    title: "Christmas Market at Römer",
    category: "cultural",
    startDate: "2026-12-03",
    location: "Römerberg",
    summary: "Mulled wine, lights and treats at Frankfurt's historic Christmas market.",
  }),
  seed({
    title: "Latin Dance",
    category: "workshops",
    startDate: "2026-12-04",
    summary: "Salsa, bachata and more — learn some moves and dance the night away.",
  }),
  seed({
    title: "International Dinner",
    category: "cultural",
    startDate: "2026-12-08",
    summary: "Bring a dish from your home country and taste the world.",
  }),
  danceClass("Dancehall Class", "2026-12-10", "18:00", "20:00", "SH Campus"),
  seed({
    title: "Christmas Gala",
    category: "parties",
    status: "tentative",
    startDate: "2026-12-12",
    summary: "A festive gala evening to celebrate the end of the year. Still to be confirmed.",
  }),
  seed({
    title: "Crochet Gathering",
    category: "workshops",
    startDate: "2026-12-13",
    startTime: "15:00",
    summary: "Bring your yarn (or learn from scratch) and crochet in good company.",
  }),
  danceClass("Afro Dance Class", "2026-12-17", "18:00", "20:00", "SH Campus"),

  // ── January / February 2027 ────────────────────────────────────────────
  danceClass("Afro Dance Class", "2027-01-14", "18:00", "20:00", "SH Campus"),
  danceClass("Afro Dance Class", "2027-01-21", "18:00", "20:00", "SH Campus"),
  danceClass("Dancehall Class", "2027-01-26", "18:30", "20:30", "AMKA"),
  seed({
    title: "Valentine's Party",
    category: "parties",
    status: "tentative",
    startDate: "2027-02-13",
    summary: "Celebrate love and friendship at our Valentine's party. Still to be confirmed.",
  }),
];

export const mockEvents: EsnEventInput[] = [...curated, ...danceNights, ...sundayRuns];

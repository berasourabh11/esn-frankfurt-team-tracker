import type { EventTaskInput } from "@/types/team";

/**
 * Example shifts and tasks for a few upcoming events, used to seed the local
 * (browser) team store until the Spring Boot API is available.
 */
export const mockEventTasks: EventTaskInput[] = [
  // CriminaLP: Kiosk Crawl
  {
    id: "t-crawl-route",
    eventSlug: "criminalp-kiosk-crawl-2026-11-20",
    kind: "task",
    title: "Plan the kiosk route",
    description: "Pick 4–5 kiosks around the Bahnhofsviertel and check opening hours.",
    peopleNeeded: 1,
    assigneeIds: ["m-aisha"],
    done: true,
  },
  {
    id: "t-crawl-welcome",
    eventSlug: "criminalp-kiosk-crawl-2026-11-20",
    kind: "shift",
    title: "Meeting point & ESNcard check",
    description: "Welcome participants at the meeting point, check names on the list and ESNcards.",
    startTime: "18:30",
    endTime: "19:15",
    location: "Hauptbahnhof, main entrance",
    peopleNeeded: 2,
    assigneeIds: ["m-lucas"],
  },
  {
    id: "t-crawl-leaders",
    eventSlug: "criminalp-kiosk-crawl-2026-11-20",
    kind: "shift",
    title: "Group leaders",
    description: "Lead a group of ~10 people between the kiosks and run the icebreaker games.",
    startTime: "19:00",
    endTime: "22:30",
    peopleNeeded: 4,
    assigneeIds: ["m-aisha", "m-hanna"],
  },
  {
    id: "t-crawl-photos",
    eventSlug: "criminalp-kiosk-crawl-2026-11-20",
    kind: "shift",
    title: "Photos & Instagram stories",
    description: "Take photos for Instagram and post 3–5 stories during the evening.",
    startTime: "19:00",
    endTime: "21:00",
    peopleNeeded: 1,
    assigneeIds: [],
  },

  // CriminaLP: Murder Mystery
  {
    id: "t-mystery-script",
    eventSlug: "criminalp-murder-mystery-2026-11-22",
    kind: "task",
    title: "Prepare character cards",
    description: "Print and cut the character cards and clue envelopes.",
    peopleNeeded: 2,
    assigneeIds: ["m-sofia"],
  },
  {
    id: "t-mystery-host",
    eventSlug: "criminalp-murder-mystery-2026-11-22",
    kind: "shift",
    title: "Game hosts",
    description: "Explain the rules, hand out clues and keep the story moving.",
    startTime: "18:00",
    endTime: "21:00",
    peopleNeeded: 3,
    assigneeIds: ["m-sofia", "m-elif"],
  },

  // Ice Skating
  {
    id: "t-ice-tickets",
    eventSlug: "ice-skating-2026-11-26",
    kind: "task",
    title: "Check group ticket prices",
    description: "Ask the rink about group discounts and skate rental for 20–30 people.",
    peopleNeeded: 1,
    assigneeIds: [],
  },
  {
    id: "t-ice-meet",
    eventSlug: "ice-skating-2026-11-26",
    kind: "shift",
    title: "Meeting point",
    description: "Wait at the meeting point and bring latecomers to the rink.",
    startTime: "18:30",
    endTime: "19:00",
    peopleNeeded: 2,
    assigneeIds: ["m-noah"],
  },

  // Strasbourg Day Trip
  {
    id: "t-strasbourg-bus",
    eventSlug: "strasbourg-day-trip-2026-11-29",
    kind: "task",
    title: "Book train group tickets",
    description: "Compare Deutsche Bahn group saver tickets and book for the confirmed list.",
    peopleNeeded: 1,
    assigneeIds: ["m-jonas"],
  },
  {
    id: "t-strasbourg-guides",
    eventSlug: "strasbourg-day-trip-2026-11-29",
    kind: "shift",
    title: "Trip guides",
    description:
      "Accompany the group all day, count heads at every stop and carry the first-aid kit.",
    startTime: "07:30",
    endTime: "21:00",
    location: "Frankfurt Hauptbahnhof",
    peopleNeeded: 3,
    assigneeIds: ["m-jonas", "m-omar"],
  },

  // Christmas Market at Römer
  {
    id: "t-xmas-post",
    eventSlug: "christmas-market-at-romer-2026-12-03",
    kind: "task",
    title: "Announce on Instagram & WhatsApp",
    description: "Create a post and a reminder story the day before.",
    peopleNeeded: 1,
    assigneeIds: ["m-yuki"],
  },
  {
    id: "t-xmas-host",
    eventSlug: "christmas-market-at-romer-2026-12-03",
    kind: "shift",
    title: "Hosts at the market",
    description: "Meet the group at the Römer fountain and show people around.",
    startTime: "18:00",
    endTime: "20:00",
    location: "Römerberg, Justitia fountain",
    peopleNeeded: 2,
    assigneeIds: [],
  },

  // International Dinner
  {
    id: "t-dinner-shopping",
    eventSlug: "international-dinner-2026-12-08",
    kind: "task",
    title: "Buy plates, cups and drinks",
    description: "Budget and receipts go to the treasurer.",
    peopleNeeded: 2,
    assigneeIds: ["m-chiara"],
  },
  {
    id: "t-dinner-setup",
    eventSlug: "international-dinner-2026-12-08",
    kind: "shift",
    title: "Set-up",
    description: "Arrange tables, labels for each dish and the music.",
    startTime: "17:00",
    endTime: "18:30",
    peopleNeeded: 3,
    assigneeIds: [],
  },
  {
    id: "t-dinner-cleanup",
    eventSlug: "international-dinner-2026-12-08",
    kind: "shift",
    title: "Clean-up",
    description: "Tidy the room and take out the rubbish after the dinner.",
    startTime: "21:30",
    endTime: "22:30",
    peopleNeeded: 3,
    assigneeIds: ["m-lucas"],
  },
];

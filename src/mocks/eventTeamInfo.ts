import type { EventTeamInfo } from "@/types/team";

/** Example hosts, notes and links (seed for the local team store). */
export const mockEventTeamInfo: EventTeamInfo[] = [
  {
    eventSlug: "ice-skating-2026-11-26",
    hostIds: ["m-noah", "m-lucas"],
    notes: "Meet at the rink entrance. Skate rental is paid on site — remind people to bring cash.",
    links: [],
  },
  {
    eventSlug: "strasbourg-day-trip-2026-11-29",
    hostIds: ["m-jonas", "m-omar"],
    notes:
      "Train leaves early — the meeting time is 15 minutes before departure.\nCollect emergency contacts from everyone in the sign-up form.",
    links: [
      { id: "l-sbg-form", label: "Sign-up form", url: "https://forms.example.org/strasbourg" },
      { id: "l-sbg-db", label: "Deutsche Bahn group tickets", url: "https://www.bahn.de/" },
    ],
  },
  {
    eventSlug: "christmas-market-at-romer-2026-12-03",
    hostIds: ["m-sofia"],
    notes: "",
    links: [],
  },
  {
    eventSlug: "international-dinner-2026-12-08",
    hostIds: ["m-chiara", "m-aisha"],
    notes:
      "Each participant brings one dish from home. Ask people to label ingredients (allergies!).\nBudget for plates and drinks: ask the treasurer.",
    links: [
      {
        id: "l-dinner-sheet",
        label: "Who brings what (sheet)",
        url: "https://sheets.example.org/dinner",
      },
      {
        id: "l-dinner-chat",
        label: "Hosts WhatsApp group",
        url: "https://chat.whatsapp.com/example",
      },
    ],
  },
  {
    eventSlug: "halloween-party-2026-10-30",
    hostIds: ["m-mateo", "m-aisha"],
    notes: "",
    links: [],
  },
];

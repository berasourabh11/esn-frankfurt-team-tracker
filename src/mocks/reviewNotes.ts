import type { ReviewNote } from "@/types/team";

/** Example review notes for past events (seed for the local team store). */
export const mockReviewNotes: ReviewNote[] = [
  {
    id: "r-halloween-1",
    eventSlug: "halloween-party-2026-10-30",
    kind: "went-well",
    text: "Great turnout and the costume contest got everyone talking.",
    authorId: "m-mateo",
    createdAt: "2026-11-02T19:10:00.000Z",
  },
  {
    id: "r-halloween-2",
    eventSlug: "halloween-party-2026-10-30",
    kind: "improve",
    text: "The queue at the entrance was long — have two people checking the list next time.",
    authorId: "m-aisha",
    createdAt: "2026-11-02T19:14:00.000Z",
  },
  {
    id: "r-halloween-3",
    eventSlug: "halloween-party-2026-10-30",
    kind: "improve",
    text: "Posters went up too late; start promotion two weeks before.",
    authorId: "m-yuki",
    createdAt: "2026-11-02T19:20:00.000Z",
  },
];

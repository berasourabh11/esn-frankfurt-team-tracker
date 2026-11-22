import type { Member } from "@/types/team";

/**
 * Fictional demo members (also the seed for the API database). Names from the
 * planning sheet are intentionally not used here.
 */
export const mockMembers: Member[] = [
  {
    id: "m-lena",
    name: "Lena Hoffmann",
    email: "lena@esn-frankfurt.example",
    role: "moderator",
    team: "President",
  },
  {
    id: "m-mateo",
    name: "Mateo García",
    email: "mateo@esn-frankfurt.example",
    role: "member",
    team: "Events",
  },
  {
    id: "m-aisha",
    name: "Aisha Khan",
    email: "aisha@esn-frankfurt.example",
    role: "member",
    team: "Events",
  },
  {
    id: "m-jonas",
    name: "Jonas Weber",
    email: "jonas@esn-frankfurt.example",
    role: "member",
    team: "Trips",
  },
  {
    id: "m-sofia",
    name: "Sofia Rossi",
    email: "sofia@esn-frankfurt.example",
    role: "member",
    team: "Culture",
  },
  {
    id: "m-yuki",
    name: "Yuki Tanaka",
    email: "yuki@esn-frankfurt.example",
    role: "user",
    team: "Communication",
  },
  {
    id: "m-lucas",
    name: "Lucas Martin",
    email: "lucas@esn-frankfurt.example",
    role: "user",
    team: "Events",
  },
  {
    id: "m-elif",
    name: "Elif Demir",
    email: "elif@esn-frankfurt.example",
    role: "user",
    team: "Buddy Programme",
  },
  {
    id: "m-noah",
    name: "Noah Fischer",
    email: "noah@esn-frankfurt.example",
    role: "user",
    team: "Sports",
  },
  {
    id: "m-chiara",
    name: "Chiara Bianchi",
    email: "chiara@esn-frankfurt.example",
    role: "user",
    team: "Communication",
  },
  {
    id: "m-omar",
    name: "Omar Haddad",
    email: "omar@esn-frankfurt.example",
    role: "user",
    team: "Trips",
  },
  {
    id: "m-hanna",
    name: "Hanna Nowak",
    email: "hanna@esn-frankfurt.example",
    role: "user",
    team: "Events",
  },
  // Registered themselves; waiting for a moderator to accept them.
  {
    id: "m-ana",
    name: "Ana Silva",
    email: "ana@student.example",
    role: "user",
    status: "pending",
    createdAt: "2026-11-19T17:42:00.000Z",
  },
  {
    id: "m-tom",
    name: "Tom Becker",
    email: "tom@student.example",
    role: "user",
    status: "pending",
    createdAt: "2026-11-20T09:15:00.000Z",
  },
];

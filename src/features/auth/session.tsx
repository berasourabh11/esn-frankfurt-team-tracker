"use client";

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { PUBLIC_API_BASE_URL } from "@/lib/api";
import { createHttpAuthService, type AuthService } from "@/services/authService";
import { teamKeys, useMembers, useTeamStorageSync } from "@/services/teamClient";
import { isPending, type Member, type RegisterValues } from "@/types/team";

/**
 * The signed-in member.
 *
 * - API mode (`NEXT_PUBLIC_API_BASE_URL` set): real e-mail + password sign-in;
 *   the API keeps the session in an HttpOnly cookie and `/api/auth/me` says
 *   who is signed in.
 * - Demo mode: "sign in as" a demo member, remembered in localStorage.
 *
 * Consumers only use `useSession()`.
 */
export type SessionMode = "api" | "demo";
export const SESSION_MODE: SessionMode = PUBLIC_API_BASE_URL ? "api" : "demo";

let authService: AuthService | null = null;
export function getAuthService(): AuthService {
  if (!PUBLIC_API_BASE_URL) throw new Error("No API configured (NEXT_PUBLIC_API_BASE_URL)");
  authService ??= createHttpAuthService({ baseUrl: PUBLIC_API_BASE_URL });
  return authService;
}

const meKey = ["auth", "me"] as const;

// ─── Demo mode: remembered member id ────────────────────────────────────────
const SESSION_KEY = "esn-frankfurt:session:v1";
const SESSION_EVENT = "esn-session-change";
let memorySessionId: string | null = null;

function readSessionId(): string | null {
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

function writeSessionId(id: string | null) {
  try {
    if (id) window.localStorage.setItem(SESSION_KEY, id);
    else window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable: session lasts until reload.
    memorySessionId = id;
  }
  window.dispatchEvent(new Event(SESSION_EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (e: StorageEvent) => e.key === SESSION_KEY && onChange();
  window.addEventListener("storage", onStorage);
  window.addEventListener(SESSION_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(SESSION_EVENT, onChange);
  };
}

interface SessionValue {
  mode: SessionMode;
  /** The signed-in, accepted account, or null (visitors and pending registrations). */
  member: Member | null;
  /** A signed-in account that is still waiting for a moderator. */
  pending: Member | null;
  /** False until the session is known in the browser (avoids flicker). */
  ready: boolean;
  /** Accepted people (pending registrations are left out). */
  members: Member[];
  /** Demo mode: sign in as a demo member. */
  signIn: (memberId: string) => void;
  /** API mode: sign in with e-mail and password. Throws with a readable message. */
  signInWithPassword: (email: string, password: string) => Promise<void>;
  /** API mode: create an account; it waits for a moderator. Throws with a readable message. */
  register: (values: RegisterValues) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  useTeamStorageSync();
  const queryClient = useQueryClient();
  const { data: allMembers, isSuccess } = useMembers();
  const members = useMemo(() => (allMembers ?? []).filter((m) => !isPending(m)), [allMembers]);

  // undefined on the server / during hydration, string|null afterwards.
  const demoId = useSyncExternalStore<string | null | undefined>(
    subscribe,
    () => readSessionId() ?? memorySessionId,
    () => undefined,
  );

  const me = useQuery({
    queryKey: meKey,
    queryFn: () => getAuthService().me(),
    enabled: SESSION_MODE === "api" && typeof window !== "undefined",
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const signIn = useCallback((id: string) => writeSessionId(id), []);

  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const member = await getAuthService().login(email, password);
      queryClient.setQueryData(meKey, member);
      // Signed-in members see more (e.g. all members, notes, shifts).
      await queryClient.invalidateQueries({ queryKey: teamKeys.all });
    },
    [queryClient],
  );

  const register = useCallback(
    async (values: RegisterValues) => {
      const account = await getAuthService().register(values);
      queryClient.setQueryData(meKey, account);
    },
    [queryClient],
  );

  const signOut = useCallback(async () => {
    if (SESSION_MODE === "demo") {
      writeSessionId(null);
      return;
    }
    try {
      await getAuthService().logout();
    } finally {
      queryClient.setQueryData(meKey, null);
      queryClient.removeQueries({ queryKey: teamKeys.all, type: "inactive" });
      await queryClient.invalidateQueries({ queryKey: teamKeys.all });
    }
  }, [queryClient]);

  const value = useMemo<SessionValue>(() => {
    if (SESSION_MODE === "api") {
      const account = me.data ?? null;
      const active = account && !isPending(account) ? account : null;
      return {
        mode: "api",
        // Prefer the directory entry (kept fresh after edits), else /me.
        member: active ? (members.find((m) => m.id === active.id) ?? active) : null,
        pending: account && isPending(account) ? account : null,
        ready: me.isFetched && isSuccess,
        members,
        signIn,
        signInWithPassword,
        register,
        signOut,
      };
    }
    return {
      mode: "demo",
      member: members.find((m) => m.id === demoId) ?? null,
      pending: null,
      ready: demoId !== undefined && isSuccess,
      members,
      signIn,
      signInWithPassword: async () => {
        throw new Error("Password sign-in needs the API (NEXT_PUBLIC_API_BASE_URL).");
      },
      register: async () => {
        throw new Error("Registration needs the API (NEXT_PUBLIC_API_BASE_URL).");
      },
      signOut,
    };
  }, [
    me.data,
    me.isFetched,
    members,
    demoId,
    isSuccess,
    signIn,
    signInWithPassword,
    register,
    signOut,
  ]);

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside <SessionProvider>");
  return value;
}

/** Re-checks the session, e.g. to see whether a moderator has accepted the account. */
export function useRefreshSession() {
  const queryClient = useQueryClient();
  return useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: meKey });
    await queryClient.invalidateQueries({ queryKey: teamKeys.all });
  }, [queryClient]);
}

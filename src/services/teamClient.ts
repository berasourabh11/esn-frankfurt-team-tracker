"use client";

import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { PUBLIC_API_BASE_URL } from "@/lib/api";

import { EVENT_CHANGES_STORAGE_KEY } from "./eventAdminService";
import { eventKeys } from "./eventKeys";
import type {
  EventTeamInfoPatch,
  MemberFormValues,
  MemberRole,
  ReviewNoteKind,
  TaskFormValues,
} from "@/types/team";

import {
  EVENT_INFO_STORAGE_KEY,
  MEMBERS_STORAGE_KEY,
  emptyEventInfo,
  createHttpTeamService,
  createLocalTeamService,
  REVIEW_STORAGE_KEY,
  TEAM_STORAGE_KEY,
  type TeamService,
} from "./teamService";

/**
 * Client access to team data. Uses the browser store (demo mode) until
 * NEXT_PUBLIC_API_BASE_URL points at the API.
 */
const TEAM_API_BASE_URL = PUBLIC_API_BASE_URL;

let service: TeamService | null = null;
export function getTeamService(): TeamService {
  service ??= TEAM_API_BASE_URL
    ? createHttpTeamService({ baseUrl: TEAM_API_BASE_URL })
    : createLocalTeamService();
  return service;
}

/** For tests: swap the implementation. */
export function setTeamService(next: TeamService | null) {
  service = next;
}

export const teamKeys = {
  all: ["team"] as const,
  members: () => [...teamKeys.all, "members"] as const,
  eventTasks: (slug: string) => [...teamKeys.all, "event-tasks", slug] as const,
  memberTasks: (id: string) => [...teamKeys.all, "member-tasks", id] as const,
  reviewNotes: (slug: string) => [...teamKeys.all, "reviews", slug] as const,
  eventInfos: () => [...teamKeys.all, "event-infos"] as const,
};

/** Hosts, notes and links for every event (small, loaded once). */
export function useEventInfos() {
  return useQuery({
    queryKey: teamKeys.eventInfos(),
    queryFn: () => getTeamService().listEventInfos(),
    enabled: typeof window !== "undefined",
  });
}

export function useEventInfo(eventSlug: string) {
  const query = useEventInfos();
  return {
    ...query,
    info: query.data?.find((i) => i.eventSlug === eventSlug) ?? emptyEventInfo(eventSlug),
  };
}

/** Updates team info for any event (e.g. a freshly created one). */
export function useSaveEventInfo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { eventSlug: string; patch: EventTeamInfoPatch; updatedBy?: string }) =>
      getTeamService().updateEventInfo(v.eventSlug, v.patch, v.updatedBy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useUpdateEventInfo(eventSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (v: { patch: EventTeamInfoPatch; updatedBy?: string }) =>
      getTeamService().updateEventInfo(eventSlug, v.patch, v.updatedBy),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: teamKeys.all }),
  });
}

export function useMembers() {
  return useQuery({
    queryKey: teamKeys.members(),
    queryFn: () => getTeamService().listMembers(),
    staleTime: Infinity,
  });
}

export function useEventTasks(eventSlug: string, enabled = true) {
  return useQuery({
    queryKey: teamKeys.eventTasks(eventSlug),
    queryFn: () => getTeamService().listEventTasks(eventSlug),
    enabled,
  });
}

export function useMemberTasks(memberId: string | undefined) {
  return useQuery({
    queryKey: teamKeys.memberTasks(memberId ?? ""),
    queryFn: () => getTeamService().listMemberTasks(memberId!),
    enabled: Boolean(memberId),
  });
}

export function useReviewNotes(eventSlug: string, enabled = true) {
  return useQuery({
    queryKey: teamKeys.reviewNotes(eventSlug),
    queryFn: () => getTeamService().listReviewNotes(eventSlug),
    enabled,
  });
}

/** Accepting, adding, editing and removing people (moderators only). */
export function useMemberMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: teamKeys.all });
  return {
    createMember: useMutation({
      mutationFn: (values: MemberFormValues) => getTeamService().createMember(values),
      onSuccess,
    }),
    updateMember: useMutation({
      mutationFn: (v: { memberId: string; patch: Partial<MemberFormValues> }) =>
        getTeamService().updateMember(v.memberId, v.patch),
      onSuccess,
    }),
    approveMember: useMutation({
      mutationFn: (v: { memberId: string; role: MemberRole }) =>
        getTeamService().approveMember(v.memberId, v.role),
      onSuccess,
    }),
    deleteMember: useMutation({
      mutationFn: (memberId: string) => getTeamService().deleteMember(memberId),
      onSuccess,
    }),
  };
}

/** All task/review mutations for one event. Every success refreshes team data. */
export function useTeamMutations(eventSlug: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => queryClient.invalidateQueries({ queryKey: teamKeys.all });
  const svc = () => getTeamService();

  return {
    createTask: useMutation({
      mutationFn: (v: { values: TaskFormValues; createdBy?: string }) =>
        svc().createTask(eventSlug, v.values, v.createdBy),
      onSuccess,
    }),
    updateTask: useMutation({
      mutationFn: (v: { taskId: string; patch: Partial<TaskFormValues> & { done?: boolean } }) =>
        svc().updateTask(v.taskId, v.patch),
      onSuccess,
    }),
    deleteTask: useMutation({
      mutationFn: (taskId: string) => svc().deleteTask(taskId),
      onSuccess,
    }),
    assign: useMutation({
      mutationFn: (v: { taskId: string; memberId: string }) => svc().assign(v.taskId, v.memberId),
      onSuccess,
    }),
    unassign: useMutation({
      mutationFn: (v: { taskId: string; memberId: string }) => svc().unassign(v.taskId, v.memberId),
      onSuccess,
    }),
    addReviewNote: useMutation({
      mutationFn: (v: { kind: ReviewNoteKind; text: string; authorId: string }) =>
        svc().addReviewNote(eventSlug, { kind: v.kind, text: v.text }, v.authorId),
      onSuccess,
    }),
    deleteReviewNote: useMutation({
      mutationFn: (noteId: string) => svc().deleteReviewNote(noteId),
      onSuccess,
    }),
  };
}

/** Refreshes team data when another tab changes the local store. */
export function useTeamStorageSync() {
  const queryClient = useQueryClient();
  useEffect(() => {
    if (TEAM_API_BASE_URL) return;
    const onStorage = (e: StorageEvent) => {
      if (
        e.key === TEAM_STORAGE_KEY ||
        e.key === REVIEW_STORAGE_KEY ||
        e.key === EVENT_INFO_STORAGE_KEY ||
        e.key === MEMBERS_STORAGE_KEY
      ) {
        queryClient.invalidateQueries({ queryKey: teamKeys.all });
      }
      if (e.key === EVENT_CHANGES_STORAGE_KEY) {
        queryClient.invalidateQueries({ queryKey: eventKeys.all });
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [queryClient]);
}

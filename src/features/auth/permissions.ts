import type { EventTask, Member, ReviewNote } from "@/types/team";

/**
 * UI-level permission checks. They only decide what the interface offers;
 * the API (/backend) enforces the same rules.
 *
 * - Admins can do everything below.
 * - Moderators accept registrations, decide roles and remove accounts.
 * - Members (role) manage events, shifts/tasks, hosts and notes, and assign anyone.
 * - Users can join open spots, leave, and tick off their own tasks.
 * - Moderators have the same team access as users.
 * - Anyone accepted can add review notes; authors and members can remove them.
 * - Pending registrations have no team access.
 */
export function canManageTasks(member: Member | null): boolean {
  return isActive(member) && (member?.role === "member" || member?.role === "admin");
}

/** Accepted accounts only: pending registrations get no team access. */
export function isActive(member: Member | null): boolean {
  return !!member && member.status !== "pending";
}

export function isAssigned(member: Member | null, task: EventTask): boolean {
  return !!member && task.assigneeIds.includes(member.id);
}

export function canJoin(member: Member | null, task: EventTask): boolean {
  return (
    !!member &&
    !task.done &&
    !isAssigned(member, task) &&
    task.assigneeIds.length < task.peopleNeeded
  );
}

export function canToggleDone(member: Member | null, task: EventTask): boolean {
  return canManageTasks(member) || isAssigned(member, task);
}

export function canDeleteReviewNote(member: Member | null, note: ReviewNote): boolean {
  return canManageTasks(member) || member?.id === note.authorId;
}

/** Accepting registrations, editing and removing accounts, and changing roles. */
export function canManageMembers(member: Member | null): boolean {
  return isActive(member) && (member?.role === "moderator" || member?.role === "admin");
}

/** Creating, editing and removing events; editing hosts, notes and links. */
export function canManageEvents(member: Member | null): boolean {
  return canManageTasks(member);
}

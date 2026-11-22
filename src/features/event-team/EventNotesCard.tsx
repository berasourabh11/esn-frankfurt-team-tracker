"use client";

import { useId, useState } from "react";
import { ExternalLink, Link2, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, Textarea, TextField } from "@/components/ui/form-controls";
import { Skeleton } from "@/components/ui/skeleton";
import { formatShortDate } from "@/lib/dateUtils";
import { canManageEvents } from "@/features/auth/permissions";
import { useEventInfo, useUpdateEventInfo } from "@/services/teamClient";
import { ImportantLinkSchema, type ImportantLink, type Member } from "@/types/team";

/**
 * Team-only notes and important links for an event (sign-up form, budget
 * sheet, WhatsApp group…). Visible to all members, editable by managers.
 */
export function EventNotesCard({
  eventSlug,
  viewer,
  members,
}: {
  eventSlug: string;
  viewer: Member;
  members: Member[];
}) {
  const { info, isPending } = useEventInfo(eventSlug);
  const [editing, setEditing] = useState(false);
  const manager = canManageEvents(viewer);
  const editor = members.find((m) => m.id === info.updatedBy);

  if (isPending) return <Skeleton className="h-32 rounded-2xl" />;

  const empty = !info.notes.trim() && info.links.length === 0;

  return (
    <section
      aria-labelledby={`${eventSlug}-notes-heading`}
      className="rounded-2xl border bg-muted/40 p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 id={`${eventSlug}-notes-heading`} className="flex items-center gap-2 font-bold">
          <NotebookPen className="size-4 text-primary" aria-hidden="true" />
          Notes & important links
        </h3>
        {manager && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil />
            {empty ? "Add notes" : "Edit"}
          </Button>
        )}
      </div>

      {empty ? (
        <p className="mt-2 text-sm text-muted-foreground">
          {manager
            ? "Add a briefing for the team and links like the sign-up form, budget sheet or group chat."
            : "No notes yet."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-4">
          {info.notes.trim() && (
            <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
              {info.notes}
            </p>
          )}
          {info.links.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Important links">
              {info.links.map((link) => (
                <li key={link.id}>
                  <a
                    href={link.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm font-semibold text-primary transition hover:border-primary/30 hover:bg-accent"
                  >
                    <Link2 className="size-4 shrink-0" aria-hidden="true" />
                    <span className="truncate">{link.label}</span>
                    <ExternalLink className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          )}
          {info.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last updated {formatShortDate(info.updatedAt.slice(0, 10))}
              {editor ? ` by ${editor.name}` : ""}
            </p>
          )}
        </div>
      )}

      <EditNotesDialog
        open={editing}
        onOpenChange={setEditing}
        eventSlug={eventSlug}
        notes={info.notes}
        links={info.links}
        viewerId={viewer.id}
      />
    </section>
  );
}

type DraftLink = { id: string; label: string; url: string };

function EditNotesDialog({
  open,
  onOpenChange,
  eventSlug,
  notes,
  links,
  viewerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventSlug: string;
  notes: string;
  links: ImportantLink[];
  viewerId: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-5 p-6 sm:p-7">
        {open && (
          <NotesForm
            eventSlug={eventSlug}
            notes={notes}
            links={links}
            viewerId={viewerId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function NotesForm({
  eventSlug,
  notes,
  links,
  viewerId,
  onDone,
}: {
  eventSlug: string;
  notes: string;
  links: ImportantLink[];
  viewerId: string;
  onDone: () => void;
}) {
  const id = useId();
  const update = useUpdateEventInfo(eventSlug);
  const [text, setText] = useState(notes);
  const [drafts, setDrafts] = useState<DraftLink[]>(links.length ? links : []);
  const [errors, setErrors] = useState<Record<string, { label?: string; url?: string }>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const setDraft = (draftId: string, patch: Partial<DraftLink>) =>
    setDrafts((list) => list.map((l) => (l.id === draftId ? { ...l, ...patch } : l)));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nextErrors: typeof errors = {};
    const valid: ImportantLink[] = [];
    for (const draft of drafts) {
      if (!draft.label.trim() && !draft.url.trim()) continue; // ignore empty rows
      const withScheme =
        draft.url.trim() && !/^[a-z]+:\/\//i.test(draft.url.trim())
          ? `https://${draft.url.trim()}`
          : draft.url.trim();
      const result = ImportantLinkSchema.safeParse({ ...draft, url: withScheme });
      if (result.success) valid.push(result.data);
      else {
        const issues = result.error.issues;
        nextErrors[draft.id] = {
          label: issues.find((i) => i.path[0] === "label")?.message,
          url: issues.find((i) => i.path[0] === "url")?.message,
        };
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    try {
      await update.mutateAsync({
        patch: { notes: text.trim(), links: valid },
        updatedBy: viewerId,
      });
      onDone();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Couldn't save the notes.");
    }
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-5">
      <DialogHeader className="pr-8">
        <DialogTitle>Notes & important links</DialogTitle>
        <DialogDescription>
          Only visible to the ESN team. Use it for the briefing, budget and anything hosts need.
        </DialogDescription>
      </DialogHeader>

      <Field id={`${id}-notes`} label="Notes" hint="What should the team know?">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          maxLength={4000}
          autoFocus
        />
      </Field>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-semibold">Important links</legend>
        {drafts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No links yet, e.g. sign-up form, budget sheet or WhatsApp group.
          </p>
        )}
        {drafts.map((draft, index) => (
          <div
            key={draft.id}
            className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)_auto] sm:items-start"
          >
            <Field
              id={`${id}-${draft.id}-label`}
              label={`Link ${index + 1} name`}
              error={errors[draft.id]?.label}
            >
              <TextField
                value={draft.label}
                onChange={(e) => setDraft(draft.id, { label: e.target.value })}
                placeholder="Sign-up form"
                maxLength={60}
              />
            </Field>
            <Field
              id={`${id}-${draft.id}-url`}
              label={`Link ${index + 1} URL`}
              error={errors[draft.id]?.url}
            >
              <TextField
                type="url"
                inputMode="url"
                value={draft.url}
                onChange={(e) => setDraft(draft.id, { url: e.target.value })}
                placeholder="https://"
              />
            </Field>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="sm:mt-6"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => setDrafts((list) => list.filter((l) => l.id !== draft.id))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-start"
          disabled={drafts.length >= 20}
          onClick={() =>
            setDrafts((list) => [
              ...list,
              { id: `l-${Math.random().toString(36).slice(2, 9)}`, label: "", url: "" },
            ])
          }
        >
          <Plus />
          Add link
        </Button>
      </fieldset>

      {formError && (
        <p
          role="alert"
          className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive"
        >
          {formError}
        </p>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={update.isPending}>
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

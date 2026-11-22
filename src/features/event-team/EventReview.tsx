"use client";

import { useId, useState } from "react";
import { Check, Copy, Hourglass, Lightbulb, ThumbsUp, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form-controls";
import { MemberAvatar } from "@/components/ui/member-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { formatLongDate, formatShortDate } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { canDeleteReviewNote } from "@/features/auth/permissions";
import { useReviewNotes, useTeamMutations } from "@/services/teamClient";
import {
  REVIEW_NOTE_LABELS,
  ReviewNoteFormSchema,
  type Member,
  type ReviewNote,
  type ReviewNoteKind,
} from "@/types/team";

const COLUMNS: Record<
  ReviewNoteKind,
  { icon: typeof ThumbsUp; accent: string; tint: string; placeholder: string }
> = {
  "went-well": {
    icon: ThumbsUp,
    accent: "#3D6B18",
    tint: "#F0F8E9",
    placeholder: "e.g. Lots of new faces, the icebreakers worked great…",
  },
  improve: {
    icon: Lightbulb,
    accent: "#A84A05",
    tint: "#FEF1E7",
    placeholder: "e.g. Start promotion earlier, need a second person at the door…",
  },
};

/**
 * Post-event review for the team meeting: what went well and what could be
 * better. Opens on the event day; before that it shows a short notice.
 */
export function EventReview({
  event,
  viewer,
  members,
  today,
  onError,
}: {
  event: { slug: string; title: string; startDate: string };
  viewer: Member;
  members: Member[];
  today: string;
  onError: (message: string) => void;
}) {
  const { data: notes, isPending } = useReviewNotes(event.slug);
  const m = useTeamMutations(event.slug);
  const [copied, setCopied] = useState(false);
  const open = today >= event.startDate;

  if (!open) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-10 text-center">
        <Hourglass className="size-8 text-muted-foreground" aria-hidden="true" />
        <p className="font-semibold">The review opens once the event has happened</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          After {formatLongDate(event.startDate)}, the team can collect what went well and what
          could be better here, ready for the next meeting.
        </p>
      </div>
    );
  }

  if (isPending || !notes) {
    return (
      <div className="grid gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading review">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    );
  }

  async function copySummary() {
    const nameOf = (id: string) => members.find((x) => x.id === id)?.name ?? "Former member";
    const section = (kind: ReviewNoteKind) => {
      const items = notes!.filter((n) => n.kind === kind);
      return [
        `## ${REVIEW_NOTE_LABELS[kind]}`,
        ...(items.length ? items.map((n) => `- ${n.text} (${nameOf(n.authorId)})`) : ["- —"]),
      ].join("\n");
    };
    const text = [
      `# Review: ${event.title} (${formatShortDate(event.startDate)})`,
      section("went-well"),
      section("improve"),
    ].join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      onError("Couldn't copy to the clipboard.");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Collect feedback for the next team meeting. Everyone on the team can add notes.
        </p>
        <Button variant="outline" size="sm" onClick={copySummary} disabled={notes.length === 0}>
          {copied ? <Check /> : <Copy />}
          {copied ? "Copied" : "Copy for meeting notes"}
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(["went-well", "improve"] as const).map((kind) => (
          <ReviewColumn
            key={kind}
            kind={kind}
            notes={notes.filter((n) => n.kind === kind)}
            viewer={viewer}
            members={members}
            onAdd={async (text) => {
              try {
                await m.addReviewNote.mutateAsync({ kind, text, authorId: viewer.id });
              } catch (error) {
                onError(error instanceof Error ? error.message : "Couldn't save the note.");
                throw error;
              }
            }}
            onDelete={(id) =>
              m.deleteReviewNote.mutateAsync(id).catch(() => onError("Couldn't delete the note."))
            }
          />
        ))}
      </div>
    </div>
  );
}

function ReviewColumn({
  kind,
  notes,
  viewer,
  members,
  onAdd,
  onDelete,
}: {
  kind: ReviewNoteKind;
  notes: ReviewNote[];
  viewer: Member;
  members: Member[];
  onAdd: (text: string) => Promise<void>;
  onDelete: (id: string) => void;
}) {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const { icon: Icon, accent, tint, placeholder } = COLUMNS[kind];
  const label = REVIEW_NOTE_LABELS[kind];

  async function submit() {
    const result = ReviewNoteFormSchema.safeParse({ kind, text });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid note");
      return;
    }
    setSaving(true);
    try {
      await onAdd(result.data.text);
      setText("");
      setError(null);
    } catch {
      // Error already surfaced by the parent.
    } finally {
      setSaving(false);
    }
  }

  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="flex flex-col overflow-hidden rounded-2xl border bg-card"
    >
      <header className="flex items-center gap-2 px-4 py-3" style={{ backgroundColor: tint }}>
        <Icon className="size-5" style={{ color: accent }} aria-hidden="true" />
        <h3 id={`${id}-heading`} className="font-bold" style={{ color: accent }}>
          {label}
        </h3>
        <span
          className="ml-auto rounded-full bg-white/80 px-2 py-0.5 text-xs font-bold"
          style={{ color: accent }}
        >
          {notes.length}
        </span>
      </header>

      <ul className="flex flex-1 flex-col gap-1 p-2">
        {notes.length === 0 && (
          <li className="px-2 py-4 text-center text-sm text-muted-foreground">No notes yet.</li>
        )}
        {notes.map((note) => {
          const author = members.find((x) => x.id === note.authorId);
          return (
            <li key={note.id} className="group flex gap-2.5 rounded-xl p-2 hover:bg-muted/60">
              {author && <MemberAvatar member={author} size="sm" />}
              <div className="min-w-0 flex-1">
                <p className="text-sm whitespace-pre-line">{note.text}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {author?.name ?? "Former member"}
                  {" · "}
                  {formatShortDate(note.createdAt.slice(0, 10))}
                </p>
              </div>
              {canDeleteReviewNote(viewer, note) && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="opacity-60 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={`Delete note: ${note.text.slice(0, 40)}`}
                  onClick={() => onDelete(note.id)}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <form
        className="flex flex-col gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <label htmlFor={`${id}-input`} className="sr-only">
          Add to “{label}”
        </label>
        <Textarea
          id={`${id}-input`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
          placeholder={placeholder}
          rows={2}
          maxLength={500}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-h-16"
        />
        {error && (
          <p id={`${id}-error`} className="text-xs font-semibold text-destructive">
            {error}
          </p>
        )}
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={saving || text.trim() === ""}
          className={cn("self-end")}
        >
          Add note
        </Button>
      </form>
    </section>
  );
}

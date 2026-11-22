import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { mockMembers } from "@/mocks/members";
import { setTeamService } from "@/services/teamClient";
import { createLocalTeamService, type KeyValueStorage } from "@/services/teamService";
import type { EventTaskInput, Member } from "@/types/team";

import { ShiftsAndTasks } from "./ShiftsAndTasks";

const EVENT = { slug: "ice-skating-2026-11-26", startDate: "2026-11-26" };
const organiser = mockMembers.find((m) => m.id === "m-aisha")!;
const volunteer = mockMembers.find((m) => m.id === "m-lucas")!;

const seed: EventTaskInput[] = [
  {
    id: "t-1",
    eventSlug: EVENT.slug,
    kind: "shift",
    title: "Meeting point",
    description: "Bring latecomers to the rink.",
    startTime: "18:30",
    endTime: "19:00",
    peopleNeeded: 2,
    assigneeIds: ["m-noah"],
  },
];

function renderPanel(viewer: Member) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const errors: string[] = [];
  render(
    <QueryClientProvider client={client}>
      <ShiftsAndTasks
        event={EVENT}
        viewer={viewer}
        members={mockMembers}
        onError={(m) => errors.push(m)}
      />
    </QueryClientProvider>,
  );
  return errors;
}

beforeEach(() => {
  const data = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
  };
  let n = 0;
  setTeamService(
    createLocalTeamService({ storage, seedTasks: seed, generateId: () => `t-new-${++n}` }),
  );
});
afterEach(() => setTeamService(null));

describe("ShiftsAndTasks", () => {
  it("lets a volunteer take and leave a shift, without management controls", async () => {
    const user = userEvent.setup();
    renderPanel(volunteer);

    const card = await screen.findByRole("article", { name: /Meeting point/ });
    expect(within(card).getByText("18:30 – 19:00")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add shift or task/ })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /Assign people/ })).not.toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Take this shift" }));
    expect(await within(card).findByText("You")).toBeInTheDocument();
    expect(within(card).getByText("Fully staffed")).toBeInTheDocument();
    expect(screen.getByText(/2 of 2/)).toBeInTheDocument();

    await user.click(within(card).getByRole("button", { name: "Leave" }));
    expect(
      await within(card).findByRole("button", { name: "Take this shift" }),
    ).toBeInTheDocument();
  });

  it("lets an organiser create a shift with validation and assign people", async () => {
    const user = userEvent.setup();
    renderPanel(organiser);
    await screen.findByRole("article", { name: /Meeting point/ });

    await user.click(screen.getByRole("button", { name: /Add shift or task/ }));
    const dialog = await screen.findByRole("dialog", { name: "New shift" });
    await user.click(within(dialog).getByRole("button", { name: "Add shift" }));
    expect(within(dialog).getByText("Give the task a short title")).toBeInTheDocument();
    expect(within(dialog).getByText("Shifts need a start time")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("Title"), "Photos");
    await user.type(within(dialog).getByLabelText(/Description/), "Take photos for Instagram");
    await user.type(within(dialog).getByLabelText("Start"), "19:00");
    const people = within(dialog).getByLabelText("People needed");
    await user.clear(people);
    await user.type(people, "1");
    await user.click(within(dialog).getByRole("button", { name: "Add shift" }));

    const created = await screen.findByRole("article", { name: /Photos/ });
    expect(created).toHaveTextContent("0 of 1 · 1 open");

    await user.click(within(created).getByRole("button", { name: "Assign people" }));
    const assign = await screen.findByRole("dialog", { name: "Assign people" });
    await user.click(within(assign).getByRole("checkbox", { name: /Yuki Tanaka/ }));
    expect(await within(assign).findByRole("checkbox", { name: /Yuki Tanaka/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    // Task is now full: others are disabled.
    expect(within(assign).getByRole("checkbox", { name: /Elif Demir/ })).toBeDisabled();
  });
});

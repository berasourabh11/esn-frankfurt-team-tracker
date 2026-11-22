import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SessionProvider } from "@/features/auth/session";
import { eventKeys } from "@/services/eventKeys";
import { makeEvent } from "@/test/factories";

import { UpcomingExplorer } from "./UpcomingExplorer";

const navigation = vi.hoisted(() => ({
  search: "",
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: navigation.replace, push: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

// Freeze "today" for the clock re-check inside useBerlinToday.
vi.mock("@/lib/dateUtils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/dateUtils")>();
  return { ...actual, getBerlinToday: () => "2026-11-20" };
});

const events = [
  makeEvent({ title: "Kiosk Crawl", category: "parties", startDate: "2026-11-20" }),
  makeEvent({ title: "Murder Mystery", category: "social", startDate: "2026-11-22" }),
  makeEvent({ title: "Ice Skating", category: "sports", startDate: "2026-11-26" }),
  makeEvent({ title: "Christmas Market", category: "cultural", startDate: "2026-12-03" }),
  makeEvent({ title: "Old Event", category: "social", startDate: "2026-11-01" }),
];

function renderExplorer() {
  const client = new QueryClient();
  client.setQueryData(eventKeys.all, events);
  return render(
    <QueryClientProvider client={client}>
      <SessionProvider>
        <UpcomingExplorer initialToday="2026-11-20" />
      </SessionProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  navigation.search = "";
  navigation.replace.mockClear();
});

describe("UpcomingExplorer", () => {
  it("groups upcoming events by time and hides past ones", () => {
    renderExplorer();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["Today", "This Week", "Next Week", "Later"]);

    const today = screen.getByRole("region", { name: "Today" });
    expect(within(today).getByText("Kiosk Crawl")).toBeInTheDocument();
    expect(screen.queryByText("Old Event")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("4 upcoming events · 2 this week");
  });

  it("applies filters from the URL", () => {
    navigation.search = "category=sports,cultural";
    renderExplorer();
    expect(screen.getByText("Ice Skating")).toBeInTheDocument();
    expect(screen.getByText("Christmas Market")).toBeInTheDocument();
    expect(screen.queryByText("Kiosk Crawl")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2 events match your filters");
  });

  it("writes category and date filters to the URL", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: /Parties & Nightlife/ }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/?category=parties", { scroll: false });

    await user.click(screen.getByRole("button", { name: "This weekend" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/?date=weekend", { scroll: false });
  });

  it("debounces search input into the URL", async () => {
    const user = userEvent.setup();
    renderExplorer();
    await user.type(screen.getByRole("searchbox", { name: "Search events" }), "ice");
    await vi.waitFor(() =>
      expect(navigation.replace).toHaveBeenLastCalledWith("/?q=ice", { scroll: false }),
    );
  });

  it("shows an empty state with a working clear action", async () => {
    navigation.search = "q=nothing-matches-this";
    const user = userEvent.setup();
    renderExplorer();

    expect(
      screen.getByRole("heading", { name: "No events match your filters" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(navigation.replace).toHaveBeenLastCalledWith("/", { scroll: false });
  });
});

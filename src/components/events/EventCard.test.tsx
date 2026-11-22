import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { makeEvent } from "@/test/factories";

import { EventCard } from "./EventCard";

describe("EventCard", () => {
  it("shows the key event information and links to the details", () => {
    const event = makeEvent({
      slug: "ice-skating-2026-11-26",
      title: "Ice Skating",
      category: "sports",
      startDate: "2026-11-26",
      startTime: "19:00",
      endTime: "21:00",
      location: "Eissporthalle",
      summary: "Winter fun on the ice.",
    });
    render(<EventCard event={event} today="2026-11-20" />);

    const link = screen.getByRole("link", { name: "Ice Skating" });
    expect(link).toHaveAttribute("href", "/events/ice-skating-2026-11-26");
    expect(screen.getByRole("article", { name: "Ice Skating" })).toBeInTheDocument();
    expect(screen.getByText("19:00 – 21:00")).toBeInTheDocument();
    expect(screen.getByText("Eissporthalle")).toBeInTheDocument();
    expect(screen.getByText("Sports")).toBeInTheDocument();
    expect(screen.getByText("Winter fun on the ice.")).toBeInTheDocument();
    expect(screen.getByText("26")).toBeInTheDocument(); // date badge
    expect(screen.getByText("In 6 days")).toBeInTheDocument();
  });

  it("handles missing time and tentative status", () => {
    render(<EventCard event={makeEvent({ status: "tentative" })} />);
    expect(screen.getByText("Time to be announced")).toBeInTheDocument();
    expect(screen.getByText("To be confirmed")).toBeInTheDocument();
  });
});

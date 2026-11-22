import { getCategoryMeta } from "@/lib/categories";
import { formatEventDateLong, formatTimeRange } from "@/lib/dateUtils";
import { OG_SIZE, renderOgImage } from "@/lib/ogImage";
import { getEventBySlug } from "@/services/events.server";

export const alt = "ESN Frankfurt event";
export const size = OG_SIZE;
export const contentType = "image/png";

export const dynamic = "force-dynamic";

/** Per-event social preview: title, date, time and place. */
export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEventBySlug(slug);

  if (!event) {
    return renderOgImage({ eyebrow: "ESN Frankfurt", title: "Event not found" });
  }

  const meta = getCategoryMeta(event.category);
  const when = [formatEventDateLong(event), formatTimeRange(event)].filter(Boolean).join(" · ");

  return renderOgImage({
    eyebrow: meta.label,
    title: event.title,
    subtitle: when,
    accent: meta.color,
    footer: event.location ? `Location: ${event.location}` : undefined,
  });
}

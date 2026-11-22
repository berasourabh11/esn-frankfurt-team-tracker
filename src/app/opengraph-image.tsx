import { OG_SIZE, renderOgImage } from "@/lib/ogImage";

export const alt = "What's happening at ESN Frankfurt?";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function Image() {
  return renderOgImage({
    eyebrow: "Events & Calendar",
    title: "What's happening at ESN Frankfurt?",
    subtitle: "Discover events, meet new people and make the most of your student life.",
  });
}

import { createFileRoute } from "@tanstack/react-router";
import { ProtectTapko } from "@/components/game/ProtectTapko";

const title = "Protect Tapko — tap-the-wolves mini game";
const description =
  "A quick mobile mini game: tap the wolves before they reach Tapko, survive the round and unlock your bonus.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <ProtectTapko />;
}

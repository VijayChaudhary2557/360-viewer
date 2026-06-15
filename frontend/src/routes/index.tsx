import { createFileRoute } from "@tanstack/react-router";
import { VirtualTour } from "@/components/tour/VirtualTour";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "360° Virtual Tour" },
      {
        name: "description",
        content: "Create and explore immersive 360° walkthroughs. Upload panoramas and link scenes with hotspots.",
      },
      { property: "og:title", content: "360° Virtual Tour" },
      {
        property: "og:description",
        content: "Create and explore immersive 360° walkthroughs.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <VirtualTour />;
}

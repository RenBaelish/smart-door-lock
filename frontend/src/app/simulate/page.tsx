import type { Metadata } from "next";
import SimulateView from "@/components/views/SimulateView";

export const metadata: Metadata = {
  title: "Live Simulation",
  description: "Test real-time face recognition against the door lock using the laptop webcam.",
};

export default function SimulatePage() {
  return <SimulateView />;
}

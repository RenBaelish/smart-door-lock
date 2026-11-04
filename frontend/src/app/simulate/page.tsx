import type { Metadata } from "next";
import SimulateView from "@/components/views/SimulateView";

export const metadata: Metadata = {
  title: "Simulasi Kamera Pintu",
  description: "Uji coba pengenalan wajah real-time pada smart door lock menggunakan kamera laptop.",
};

export default function SimulatePage() {
  return <SimulateView />;
}

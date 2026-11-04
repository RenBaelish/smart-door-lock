import type { Metadata } from "next";
import LogsView from "@/components/views/LogsView";

export const metadata: Metadata = {
  title: "Riwayat Log Akses",
  description: "Audit lengkap riwayat setiap percobaan akses pengenalan wajah pada smart door lock.",
};

export default function LogsPage() {
  return <LogsView />;
}

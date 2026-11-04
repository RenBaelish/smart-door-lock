import type { Metadata } from "next";
import ScheduleView from "@/components/views/ScheduleView";

export const metadata: Metadata = {
  title: "Jadwal Perkuliahan Smart Classroom",
  description: "Manajemen jadwal perkuliahan kelas dan hak akses pintu ruang kelas cerdas.",
};

export default function SchedulePage() {
  return <ScheduleView />;
}

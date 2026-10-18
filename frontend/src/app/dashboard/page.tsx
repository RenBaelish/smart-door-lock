import type { Metadata } from "next";
import DashboardView from "@/components/views/DashboardView";

export const metadata: Metadata = {
  title: "Dashboard",
  description: "Summary of registered users and recent door access attempts.",
};

export default function DashboardPage() {
  return <DashboardView />;
}

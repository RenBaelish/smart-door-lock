import type { Metadata } from "next";
import LogsView from "@/components/views/LogsView";

export const metadata: Metadata = {
  title: "Access Logs",
  description: "Audit history of every face recognition access attempt.",
};

export default function LogsPage() {
  return <LogsView />;
}

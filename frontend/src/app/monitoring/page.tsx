import type { Metadata } from "next";
import MonitoringView from "@/components/views/MonitoringView";

export const metadata: Metadata = {
  title: "Network & Performance Monitoring",
  description: "Live packet flow simulation, QoS performance metrics, and Wireshark packet sniffer for Star Topology.",
};

export default function MonitoringPage() {
  return <MonitoringView />;
}

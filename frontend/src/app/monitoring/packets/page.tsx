import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import WiresharkTable from "@/components/WiresharkTable";

export const metadata: Metadata = {
  title: "Analisis Paket Wireshark",
  description: "Inspeksi detail header Ethernet, IPv4, TCP/HTTP, dan payload frame jaringan.",
};

export default function PacketsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inspeksi Paket"
        title="Wireshark Live Packet Sniffer"
        description="Penganalisis paket data real-time pada jaringan Star Topology dengan filter protokol dan dissector OSI layer."
      />

      <div>
        <WiresharkTable />
      </div>

      {/* Dissector Explanation */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
        <div className="card p-5">
          <div className="caps text-[10px] text-sage mb-1">Layer 2 - Datalink</div>
          <h4 className="font-display font-semibold text-neutral-950">Ethernet II &amp; MAC Address</h4>
          <p className="mt-1.5 text-graphite leading-relaxed">
            Mendeteksi alamat perangkat fisik: Espressif (ESP32-CAM), Routerboard (MikroTik), dan Intel (Admin Laptop).
          </p>
        </div>

        <div className="card p-5">
          <div className="caps text-[10px] text-sage mb-1">Layer 3 - Network</div>
          <h4 className="font-display font-semibold text-neutral-950">Internet Protocol v4 (IPv4)</h4>
          <p className="mt-1.5 text-graphite leading-relaxed">
            Menampilkan perutean paket IP private: subnet 192.168.10.0/24 dengan TTL 64 dan verifikasi checksum.
          </p>
        </div>

        <div className="card p-5">
          <div className="caps text-[10px] text-sage mb-1">Layer 4-7 - Transport &amp; App</div>
          <h4 className="font-display font-semibold text-neutral-950">TCP Handshake &amp; HTTP REST</h4>
          <p className="mt-1.5 text-graphite leading-relaxed">
            Inspeksi sinyal SYN/ACK TCP pada port 8000 dan transfer payload REST pengenalan wajah (`POST /api/recognize`).
          </p>
        </div>
      </div>
    </div>
  );
}

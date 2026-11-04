import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import TopologyGraph from "@/components/TopologyGraph";

export const metadata: Metadata = {
  title: "Topologi Jaringan & Virtual AP Live",
  description: "Simulasi interaktif arsitektur WLAN MikroTik, 3 Virtual AP, dan penyaringan firewall NIST SP 800-41 Rev. 1.",
};

export default function TopologyPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Simulasi Jaringan"
        title="Topologi Tree &amp; Segmentasi 3 Virtual AP MikroTik"
        description="Visualisasi aliran paket data real-time melalui 3 Virtual AP (Server-Net, Admin-Net, Door-Net) dan simulasi pemblokiran firewall NIST SP 800-41."
      />

      <div>
        <TopologyGraph />
      </div>

      {/* Explanatory cards strictly aligned with Proposal */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card p-5">
          <div className="caps text-[11px] text-sage mb-1">Topologi Tree &amp; 3 Virtual AP</div>
          <h3 className="font-display text-base font-semibold text-neutral-950">MikroTik WLAN Virtualization</h3>
          <p className="mt-2 text-xs text-graphite leading-relaxed">
            MikroTik hAP Series bertindak sebagai gateway pusat yang memecah antarmuka nirkabel (wlan1) menjadi 3 Virtual AP: Server-Net (192.168.10.0/24), Admin-Net (20.0/24), dan Door-Net (30.0/24).
          </p>
        </div>

        <div className="card p-5">
          <div className="caps text-[11px] text-sage mb-1">Alur Transmisi TCP/HTTP</div>
          <h3 className="font-display text-base font-semibold text-neutral-950">Citra Wajah ~21 KB &amp; GPIO</h3>
          <p className="mt-2 text-xs text-graphite leading-relaxed">
            ESP32-CAM mengirimkan 1 citra wajah utuh melalui HTTP POST ke FastAPI Raspberry Pi (komputasi 70ms). Balasan 200 OK mentrigger relay solenoid (GPIO 27) secara sekuensial.
          </p>
        </div>

        <div className="card p-5">
          <div className="caps text-[11px] text-sage mb-1">Keamanan Firewall</div>
          <h3 className="font-display text-base font-semibold text-neutral-950">NIST SP 800-41 Rev. 1</h3>
          <p className="mt-2 text-xs text-graphite leading-relaxed">
            Kebijakan Default-Deny memblokir seluruh paket tidak sah. Hanya port 80/TCP (HTTP) dan port 22/TCP (SSH) yang diizinkan. Default Forwarding dinonaktifkan untuk mengisolasi sesama klien.
          </p>
        </div>
      </div>
    </div>
  );
}

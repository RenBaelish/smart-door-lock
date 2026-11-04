import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import NetworkCharts from "@/components/NetworkCharts";

export const metadata: Metadata = {
  title: "Performa & Analisis QoS",
  description: "Pengukuran real-time Round-Trip Time (RTT), Jitter, Throughput data, dan packet loss.",
};

export default function PerformancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Analisis QoS"
        title="Performa Jaringan & Metrik QoS"
        description="Pemantauan live waktu respon paket (RTT Ping), throughput transfer gambar, jitter, dan tingkat kehilangan paket."
      />

      <div>
        <NetworkCharts />
      </div>

      {/* QoS Standard breakdown */}
      <div className="card p-6">
        <h3 className="font-display text-base font-semibold text-neutral-950 mb-3">
          Standar Kualitas Layanan (QoS) TIPHON
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 text-xs">
          <div className="rounded-lg bg-primary-50 p-4 border border-primary-200">
            <div className="caps text-[10px] text-sage">Latensi RTT</div>
            <div className="text-sm font-bold text-mint mt-1">&lt; 50 ms (Sangat Bagus)</div>
            <p className="mt-1 text-graphite">Rata-rata sistem: ~3.2 ms antar node WLAN.</p>
          </div>

          <div className="rounded-lg bg-primary-50 p-4 border border-primary-200">
            <div className="caps text-[10px] text-sage">Jitter</div>
            <div className="text-sm font-bold text-mint mt-1">&lt; 10 ms (Optimal)</div>
            <p className="mt-1 text-graphite">Variasi kedatangan paket sangat rendah (&lt; 2 ms).</p>
          </div>

          <div className="rounded-lg bg-primary-50 p-4 border border-primary-200">
            <div className="caps text-[10px] text-sage">Packet Loss</div>
            <div className="text-sm font-bold text-mint mt-1">0% (Sempurna)</div>
            <p className="mt-1 text-graphite">Tidak ada frame pengenalan wajah yang hilang.</p>
          </div>

          <div className="rounded-lg bg-primary-50 p-4 border border-primary-200">
            <div className="caps text-[10px] text-sage">Throughput</div>
            <div className="text-sm font-bold text-secondary-600 mt-1">&gt; 35 KB/s</div>
            <p className="mt-1 text-graphite">Cukup untuk transmisi frame gambar berkecepatan tinggi.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

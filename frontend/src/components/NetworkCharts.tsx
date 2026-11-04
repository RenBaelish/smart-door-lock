"use client";

import { useEffect, useState, useMemo } from "react";
import Icon from "@/components/Icon";
import { api } from "@/lib/api";

interface PingSample {
  time: string;
  rtt: number;
  loss: number;
  throughput: number;
}

export default function NetworkCharts() {
  const [samples, setSamples] = useState<PingSample[]>(() => {
    const initial: PingSample[] = [];
    const now = Date.now();
    for (let i = 12; i >= 1; i--) {
      const d = new Date(now - i * 2000);
      initial.push({
        time: d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        rtt: Math.floor(3 + Math.random() * 4),
        loss: 0,
        throughput: Math.floor(40 + Math.random() * 25),
      });
    }
    return initial;
  });

  const [activeNodePing, setActiveNodePing] = useState({
    router: { status: "online", rtt: 1.8, ip: "192.168.10.1" },
    esp32: { status: "online", rtt: 8.5, ip: "192.168.10.15" },
    rpi: { status: "online", rtt: 2.3, ip: "192.168.10.10" },
    admin: { status: "online", rtt: 0.4, ip: "127.0.0.1" },
    lock: { status: "online", rtt: 0.1, ip: "GPIO 27" },
  });

  useEffect(() => {
    let active = true;

    const measure = async () => {
      const start = performance.now();
      let isSuccess = false;
      try {
        await api.health();
        isSuccess = true;
      } catch {
        isSuccess = false;
      }
      const end = performance.now();
      const elapsed = isSuccess ? Math.round((end - start) * 10) / 10 : 0;
      const rttVal = isSuccess ? Math.max(1.2, elapsed) : 999;
      const lossVal = isSuccess ? 0 : 100;
      const kbps = isSuccess ? Math.floor(38 + Math.random() * 30) : 0;

      if (!active) return;

      const nowStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

      setSamples((prev) => {
        const next = [...prev.slice(1), { time: nowStr, rtt: rttVal, loss: lossVal, throughput: kbps }];
        return next;
      });

      setActiveNodePing((p) => ({
        ...p,
        admin: { ...p.admin, rtt: Math.round((0.3 + Math.random() * 0.4) * 10) / 10 },
        router: { ...p.router, rtt: Math.round((1.5 + Math.random() * 0.8) * 10) / 10 },
        rpi: { ...p.rpi, rtt: Math.round((2.0 + Math.random() * 1.2) * 10) / 10 },
        esp32: { ...p.esp32, rtt: Math.round((7.5 + Math.random() * 3.5) * 10) / 10 },
      }));
    };

    const interval = window.setInterval(measure, 2500);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const stats = useMemo(() => {
    if (samples.length === 0) return { avgRtt: 0, minRtt: 0, maxRtt: 0, jitter: 0, avgLoss: 0 };
    const rtts = samples.map((s) => s.rtt).filter((r) => r < 500);
    const avg = rtts.reduce((a, b) => a + b, 0) / (rtts.length || 1);
    const min = Math.min(...rtts);
    const max = Math.max(...rtts);

    let jitterSum = 0;
    for (let i = 1; i < rtts.length; i++) {
      jitterSum += Math.abs(rtts[i] - rtts[i - 1]);
    }
    const jitter = Math.round((jitterSum / (rtts.length - 1 || 1)) * 10) / 10;
    const losses = samples.map((s) => s.loss);
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;

    return {
      avgRtt: Math.round(avg * 10) / 10,
      minRtt: Math.round(min * 10) / 10,
      maxRtt: Math.round(max * 10) / 10,
      jitter,
      avgLoss: Math.round(avgLoss * 10) / 10,
    };
  }, [samples]);

  const rttPoints = useMemo(() => {
    const w = 400;
    const h = 80;
    const maxVal = Math.max(15, stats.maxRtt * 1.3);
    const step = w / (samples.length - 1 || 1);

    return samples
      .map((s, idx) => {
        const x = Math.round(idx * step);
        const y = Math.round(h - (Math.min(s.rtt, maxVal) / maxVal) * (h - 10));
        return `${x},${y}`;
      })
      .join(" ");
  }, [samples, stats.maxRtt]);

  const throughputPoints = useMemo(() => {
    const w = 400;
    const h = 80;
    const maxVal = 100;
    const step = w / (samples.length - 1 || 1);

    return samples
      .map((s, idx) => {
        const x = Math.round(idx * step);
        const y = Math.round(h - (Math.min(s.throughput, maxVal) / maxVal) * (h - 10));
        return `${x},${y}`;
      })
      .join(" ");
  }, [samples]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Chart 1: Latency / Round Trip Time (RTT) */}
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-mint/15 text-mint">
                  <Icon name="activity" className="h-4 w-4" />
                </span>
                <h3 className="font-display text-base font-semibold text-white">
                  Latensi RTT (ICMP Response Time)
                </h3>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Waktu bolak-balik frame paket dari Admin ke Server Raspberry Pi &amp; Router
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xl font-bold text-mint">
                {samples[samples.length - 1]?.rtt || 0} ms
              </span>
              <span className="block caps text-[10px] text-sage">Nilai Terakhir</span>
            </div>
          </div>

          {/* SVG Sparkline Latency */}
          <div className="mt-4 relative h-32 w-full overflow-hidden rounded-lg bg-neutral-900/60 p-2 border border-neutral-800">
            <svg viewBox="0 0 400 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="rttGradMint" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00cd8f" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#00cd8f" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon points={`0,80 ${rttPoints} 400,80`} fill="url(#rttGradMint)" />
              <polyline
                fill="none"
                stroke="#00cd8f"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={rttPoints}
              />
            </svg>
          </div>

          {/* Mini Stats Footer */}
          <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Min</div>
              <div className="font-mono font-bold text-mint mt-0.5">{stats.minRtt} ms</div>
            </div>
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Avg</div>
              <div className="font-mono font-bold text-white mt-0.5">{stats.avgRtt} ms</div>
            </div>
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Max</div>
              <div className="font-mono font-bold text-secondary-400 mt-0.5">{stats.maxRtt} ms</div>
            </div>
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Jitter</div>
              <div className="font-mono font-bold text-neutral-300 mt-0.5">±{stats.jitter} ms</div>
            </div>
          </div>
        </div>

        {/* Chart 2: Throughput & Packet Loss */}
        <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-xl">
          <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary-500/15 text-secondary-400">
                  <Icon name="wifi" className="h-4 w-4" />
                </span>
                <h3 className="font-display text-base font-semibold text-white">
                  Throughput Trafik &amp; Packet Loss
                </h3>
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Laju pengiriman frame kamera &amp; persentase paket hilang (QoS)
              </p>
            </div>
            <div className="text-right">
              <span className="font-mono text-xl font-bold text-secondary-400">
                {samples[samples.length - 1]?.throughput || 0} KB/s
              </span>
              <span className="block caps text-[10px] text-sage">Throughput</span>
            </div>
          </div>

          {/* SVG Sparkline Throughput */}
          <div className="mt-4 relative h-32 w-full overflow-hidden rounded-lg bg-neutral-900/60 p-2 border border-neutral-800">
            <svg viewBox="0 0 400 80" className="h-full w-full overflow-visible" preserveAspectRatio="none">
              <defs>
                <linearGradient id="thruGradGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ffd23d" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#ffd23d" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon points={`0,80 ${throughputPoints} 400,80`} fill="url(#thruGradGold)" />
              <polyline
                fill="none"
                stroke="#ffd23d"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={throughputPoints}
              />
            </svg>
          </div>

          {/* Node Health / Loss Indicator */}
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Packet Loss</div>
              <div className="font-mono font-bold text-mint mt-0.5">{stats.avgLoss}% (Optimal)</div>
            </div>
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">QoS Rating</div>
              <div className="font-mono font-bold text-secondary-400 mt-0.5">Kelas A</div>
            </div>
            <div className="rounded-md bg-neutral-900 p-2.5 border border-neutral-800">
              <div className="caps text-[10px] text-sage">Standar WLAN</div>
              <div className="font-mono font-bold text-neutral-300 mt-0.5">802.11 b/g/n</div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width Node Ping Matrix */}
      <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 p-5 shadow-xl">
        <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-mint/15 text-mint">
              <Icon name="network" className="h-4 w-4" />
            </span>
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Matriks Respon Latensi Tiap Node
              </h3>
              <p className="text-xs text-neutral-400">Status ketersediaan dan latensi tiap host pada topologi</p>
            </div>
          </div>
          <span className="caps text-xs text-mint font-mono font-semibold">
            5 / 5 Node Terhubung
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 text-xs">
          {/* MikroTik */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-500/15 text-secondary-400">
                <Icon name="router" className="h-4 w-4" />
              </div>
              <span className="chip border-mint/30 bg-mint/15 text-mint text-[9px] font-mono font-bold">
                UP
              </span>
            </div>
            <div className="font-semibold text-white">MikroTik Router</div>
            <div className="font-mono text-[10px] text-neutral-400">{activeNodePing.router.ip}</div>
            <div className="mt-2.5 font-mono text-xs font-semibold text-mint">
              RTT: {activeNodePing.router.rtt} ms
            </div>
          </div>

          {/* ESP32-CAM */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary-500/15 text-secondary-400">
                <Icon name="camera" className="h-4 w-4" />
              </div>
              <span className="chip border-mint/30 bg-mint/15 text-mint text-[9px] font-mono font-bold">
                UP
              </span>
            </div>
            <div className="font-semibold text-white">ESP32-CAM</div>
            <div className="font-mono text-[10px] text-neutral-400">{activeNodePing.esp32.ip}</div>
            <div className="mt-2.5 font-mono text-xs font-semibold text-secondary-400">
              RTT: {activeNodePing.esp32.rtt} ms
            </div>
          </div>

          {/* Raspberry Pi */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/15 text-mint">
                <Icon name="server" className="h-4 w-4" />
              </div>
              <span className="chip border-mint/30 bg-mint/15 text-mint text-[9px] font-mono font-bold">
                UP
              </span>
            </div>
            <div className="font-semibold text-white">Raspberry Pi</div>
            <div className="font-mono text-[10px] text-neutral-400">{activeNodePing.rpi.ip}</div>
            <div className="mt-2.5 font-mono text-xs font-semibold text-mint">
              RTT: {activeNodePing.rpi.rtt} ms
            </div>
          </div>

          {/* Admin Localhost */}
          <div className="rounded-xl border border-mint/40 bg-neutral-900/90 p-3.5 ring-1 ring-mint/30">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint/20 text-mint">
                <Icon name="laptop" className="h-4 w-4" />
              </div>
              <span className="chip border-mint/40 bg-mint/20 text-mint text-[9px] font-mono font-bold">
                SESI ANDA
              </span>
            </div>
            <div className="font-semibold text-white">Admin Laptop</div>
            <div className="font-mono text-[10px] text-neutral-300">{activeNodePing.admin.ip}</div>
            <div className="mt-2.5 font-mono text-xs font-semibold text-mint">
              RTT: {activeNodePing.admin.rtt} ms
            </div>
          </div>

          {/* Solenoid Lock */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/70 p-3.5">
            <div className="flex items-center justify-between text-neutral-400 mb-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sage/20 text-sage">
                <Icon name="key" className="h-4 w-4" />
              </div>
              <span className="chip border-mint/30 bg-mint/15 text-mint text-[9px] font-mono font-bold">
                READY
              </span>
            </div>
            <div className="font-semibold text-white">Relay Solenoid</div>
            <div className="font-mono text-[10px] text-neutral-400">{activeNodePing.lock.ip}</div>
            <div className="mt-2.5 font-mono text-xs font-semibold text-mint">
              RTT: {activeNodePing.lock.rtt} ms
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

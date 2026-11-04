"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import Icon from "@/components/Icon";

export interface CapturedPacket {
  no: number;
  time: string;
  source: string;
  destination: string;
  protocol: "HTTP" | "TCP" | "ICMP" | "UDP" | "ARP";
  length: number;
  info: string;
  payload?: Record<string, unknown> | string;
  details?: {
    frame: string;
    ethernet: string;
    ip: string;
    transport: string;
    application?: string;
  };
}

interface WiresharkTableProps {
  incomingPacket?: {
    source: string;
    destination: string;
    protocol: string;
    info: string;
    size: number;
  } | null;
}

const INITIAL_PACKETS: CapturedPacket[] = [
  {
    no: 1,
    time: "0.000000",
    source: "192.168.10.15 (ESP32-CAM)",
    destination: "192.168.10.1 (MikroTik)",
    protocol: "ARP",
    length: 42,
    info: "Who has 192.168.10.1? Tell 192.168.10.15",
    details: {
      frame: "Frame 1: 42 bytes on wire (336 bits), 42 bytes captured",
      ethernet: "Ethernet II, Src: Espressif_a4:12:8f, Dst: Broadcast (ff:ff:ff:ff:ff:ff)",
      ip: "Address Resolution Protocol (request)",
      transport: "Target MAC: 00:00:00:00:00:00, Target IP: 192.168.10.1",
    },
  },
  {
    no: 2,
    time: "0.001420",
    source: "192.168.10.1 (MikroTik)",
    destination: "192.168.10.15 (ESP32-CAM)",
    protocol: "ARP",
    length: 42,
    info: "192.168.10.1 is at d4:01:c3:21:aa:90",
    details: {
      frame: "Frame 2: 42 bytes on wire (336 bits), 42 bytes captured",
      ethernet: "Ethernet II, Src: Routerboard_d4:01:c3, Dst: Espressif_a4:12:8f",
      ip: "Address Resolution Protocol (reply)",
      transport: "Sender MAC: d4:01:c3:21:aa:90, Sender IP: 192.168.10.1",
    },
  },
  {
    no: 3,
    time: "0.012580",
    source: "127.0.0.1 (Admin Laptop)",
    destination: "192.168.10.10 (Raspberry Pi)",
    protocol: "TCP",
    length: 74,
    info: "54231 → 8000 [SYN] Seq=0 Win=65535 Len=0 MSS=1460 WS=256",
    details: {
      frame: "Frame 3: 74 bytes on wire (592 bits)",
      ethernet: "Ethernet II, Src: Intel_88:12:34, Dst: Routerboard_d4:01:c3",
      ip: "Internet Protocol Version 4, Src: 127.0.0.1, Dst: 192.168.10.10",
      transport: "Transmission Control Protocol, Src Port: 54231, Dst Port: 8000, Seq: 0, Flags: [SYN]",
    },
  },
  {
    no: 4,
    time: "0.014102",
    source: "192.168.10.10 (Raspberry Pi)",
    destination: "127.0.0.1 (Admin Laptop)",
    protocol: "TCP",
    length: 74,
    info: "8000 → 54231 [SYN, ACK] Seq=0 Ack=1 Win=65160 Len=0 MSS=1460",
    details: {
      frame: "Frame 4: 74 bytes on wire (592 bits)",
      ethernet: "Ethernet II, Src: RaspberryPi_b8:27:eb, Dst: Intel_88:12:34",
      ip: "Internet Protocol Version 4, Src: 192.168.10.10, Dst: 127.0.0.1",
      transport: "Transmission Control Protocol, Src Port: 8000, Dst Port: 54231, Seq: 0, Ack: 1, Flags: [SYN, ACK]",
    },
  },
  {
    no: 5,
    time: "0.014890",
    source: "127.0.0.1 (Admin Laptop)",
    destination: "192.168.10.10 (Raspberry Pi)",
    protocol: "HTTP",
    length: 182,
    info: "GET /api/health HTTP/1.1 (Monitoring Ping QoS)",
    details: {
      frame: "Frame 5: 182 bytes on wire (1456 bits)",
      ethernet: "Ethernet II, Src: Intel_88:12:34, Dst: Routerboard_d4:01:c3",
      ip: "Internet Protocol Version 4, Src: 127.0.0.1, Dst: 192.168.10.10",
      transport: "Transmission Control Protocol, Src Port: 54231, Dst Port: 8000",
      application: "Hypertext Transfer Protocol, GET /api/health HTTP/1.1\\r\\nHost: 192.168.10.10:8000",
    },
  },
  {
    no: 6,
    time: "0.018900",
    source: "192.168.10.10 (Raspberry Pi)",
    destination: "127.0.0.1 (Admin Laptop)",
    protocol: "HTTP",
    length: 245,
    info: "HTTP/1.1 200 OK (Akses Diizinkan) - status: ok",
    details: {
      frame: "Frame 6: 245 bytes on wire (1960 bits)",
      ethernet: "Ethernet II, Src: RaspberryPi_b8:27:eb, Dst: Intel_88:12:34",
      ip: "Internet Protocol Version 4, Src: 192.168.10.10, Dst: 127.0.0.1",
      transport: "Transmission Control Protocol, Src Port: 8000, Dst Port: 54231",
      application: 'HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\\r\\n{"status":"ok","db":"sqlite"}',
    },
  },
];

export default function WiresharkTable({ incomingPacket }: WiresharkTableProps) {
  const [packets, setPackets] = useState<CapturedPacket[]>(INITIAL_PACKETS);
  const [filterQuery, setFilterQuery] = useState("");
  const [selectedPacket, setSelectedPacket] = useState<CapturedPacket | null>(INITIAL_PACKETS[4]);
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const tableEndRef = useRef<HTMLDivElement>(null);
  const packetCountRef = useRef(INITIAL_PACKETS.length);
  const startTimeRef = useRef(Date.now());

  useEffect(() => {
    if (!incomingPacket || isPaused) return;

    const count = ++packetCountRef.current;
    const elapsedSec = ((Date.now() - startTimeRef.current) / 1000).toFixed(6);
    const proto = (incomingPacket.protocol.toUpperCase() as CapturedPacket["protocol"]) || "HTTP";

    const newPkt: CapturedPacket = {
      no: count,
      time: elapsedSec,
      source: incomingPacket.source,
      destination: incomingPacket.destination,
      protocol: proto,
      length: incomingPacket.size || 256,
      info: incomingPacket.info,
      details: {
        frame: `Frame ${count}: ${incomingPacket.size || 256} bytes on wire (${(incomingPacket.size || 256) * 8} bits)`,
        ethernet: `Ethernet II, Src: ${incomingPacket.source.includes("15") ? "Espressif_a4:12:8f" : "Routerboard_d4:01:c3"}`,
        ip: `Internet Protocol Version 4, Src: ${incomingPacket.source}, Dst: ${incomingPacket.destination}`,
        transport: proto === "HTTP" || proto === "TCP" ? "Transmission Control Protocol" : "Internet Control Message Protocol",
        application: proto === "HTTP" ? incomingPacket.info : undefined,
      },
    };

    setPackets((prev) => {
      const next = [...prev, newPkt];
      return next.slice(-200);
    });
  }, [incomingPacket, isPaused]);

  useEffect(() => {
    if (autoScroll && tableEndRef.current) {
      tableEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [packets, autoScroll]);

  const filteredPackets = useMemo(() => {
    if (!filterQuery.trim()) return packets;
    const q = filterQuery.toLowerCase().trim();
    return packets.filter((p) => {
      if (q === "http" || q === "tcp" || q === "icmp" || q === "arp" || q === "udp") {
        return p.protocol.toLowerCase() === q;
      }
      return (
        p.source.toLowerCase().includes(q) ||
        p.destination.toLowerCase().includes(q) ||
        p.info.toLowerCase().includes(q) ||
        p.protocol.toLowerCase().includes(q) ||
        p.no.toString() === q
      );
    });
  }, [packets, filterQuery]);

  const getProtocolStyle = (proto: CapturedPacket["protocol"]) => {
    switch (proto) {
      case "HTTP":
        return "bg-mint/10 text-mint border-l-2 border-mint hover:bg-mint/20";
      case "TCP":
        return "bg-secondary-500/10 text-secondary-300 border-l-2 border-secondary-400 hover:bg-secondary-500/20";
      case "ICMP":
        return "bg-amber-500/10 text-amber-300 border-l-2 border-amber-500 hover:bg-amber-500/20";
      case "UDP":
        return "bg-primary-500/10 text-primary-200 border-l-2 border-primary-400 hover:bg-primary-500/20";
      case "ARP":
        return "bg-sage/10 text-sage border-l-2 border-sage hover:bg-sage/20";
      default:
        return "text-neutral-300 hover:bg-neutral-800/40";
    }
  };

  const clearCapture = () => {
    setPackets([]);
    setSelectedPacket(null);
    packetCountRef.current = 0;
  };

  const exportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(packets, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `facelock_capture_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-xl">
      {/* Top Header */}
      <div className="border-b border-neutral-800 bg-neutral-900/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-mint/15 text-mint border border-mint/30">
              <Icon name="layers" className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-display text-sm font-semibold text-white sm:text-base">
                Wireshark Live Packet Sniffer
              </h3>
              <p className="text-xs text-neutral-400">
                Inspeksi real-time paket frame WLAN Star Topology (MikroTik Hub, ESP32-CAM, RPi)
              </p>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={() => setIsPaused(!isPaused)}
              className={`flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-xs font-medium transition ${
                isPaused
                  ? "border-mint/40 bg-mint/15 text-mint hover:bg-mint/25"
                  : "border-secondary-500/40 bg-secondary-500/15 text-secondary-300 hover:bg-secondary-500/25"
              }`}
            >
              <Icon name={isPaused ? "play" : "stop"} className="h-3.5 w-3.5" />
              <span>{isPaused ? "Lanjutkan" : "Jeda"}</span>
            </button>

            <button
              onClick={() => setAutoScroll(!autoScroll)}
              className={`rounded-sm border px-3 py-1.5 text-xs font-medium transition ${
                autoScroll
                  ? "border-neutral-700 bg-neutral-800 text-white"
                  : "border-neutral-800 bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
              }`}
            >
              Auto-Scroll: {autoScroll ? "ON" : "OFF"}
            </button>

            <button
              onClick={clearCapture}
              className="rounded-sm border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              Clear
            </button>

            <button
              onClick={exportJSON}
              className="flex items-center gap-1.5 rounded-sm border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs text-neutral-300 hover:bg-neutral-700"
            >
              <Icon name="download" className="h-3.5 w-3.5" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="mt-4 flex items-center gap-2">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-neutral-500">
              <Icon name="filter" className="h-3.5 w-3.5 text-secondary-400" />
            </div>
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter paket: ketik http, tcp, icmp, arp, atau kata kunci IP/port..."
              className="w-full rounded-sm border border-neutral-700 bg-neutral-900 py-1.5 pl-9 pr-8 font-mono text-xs text-neutral-200 placeholder-neutral-500 focus:border-secondary-500 focus:outline-none"
            />
            {filterQuery && (
              <button
                onClick={() => setFilterQuery("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-neutral-400 hover:text-white"
              >
                <Icon name="x" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="caps text-[10px] text-sage font-mono">
            Total: <span className="font-bold text-white">{filteredPackets.length}</span> pkt
          </div>
        </div>
      </div>

      {/* Packet Stream Table */}
      <div className="h-64 overflow-y-auto font-mono text-[11px] bg-neutral-950">
        <table className="w-full text-left">
          <thead className="sticky top-0 z-10 bg-neutral-900 text-[10px] uppercase tracking-wider text-sage border-b border-neutral-800">
            <tr>
              <th className="py-2.5 pl-4 pr-2 font-semibold">No.</th>
              <th className="py-2.5 px-2 font-semibold">Time (s)</th>
              <th className="py-2.5 px-2 font-semibold">Source</th>
              <th className="py-2.5 px-2 font-semibold">Destination</th>
              <th className="py-2.5 px-2 font-semibold">Protocol</th>
              <th className="py-2.5 px-2 font-semibold">Length</th>
              <th className="py-2.5 pl-2 pr-4 font-semibold">Info</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/50">
            {filteredPackets.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-10 text-center text-xs text-neutral-500 font-sans">
                  Tidak ada paket yang cocok dengan filter yang ditentukan.
                </td>
              </tr>
            ) : (
              filteredPackets.map((pkt) => {
                const isSelected = selectedPacket?.no === pkt.no;
                const protoStyle = getProtocolStyle(pkt.protocol);

                return (
                  <tr
                    key={pkt.no}
                    onClick={() => setSelectedPacket(pkt)}
                    className={`cursor-pointer transition-colors ${protoStyle} ${
                      isSelected ? "ring-1 ring-secondary-400 !bg-neutral-800 font-semibold" : ""
                    }`}
                  >
                    <td className="py-2 pl-4 pr-2 text-neutral-400">{pkt.no}</td>
                    <td className="py-2 px-2 text-neutral-400">{pkt.time}</td>
                    <td className="py-2 px-2 truncate max-w-[150px]" title={pkt.source}>
                      {pkt.source}
                    </td>
                    <td className="py-2 px-2 truncate max-w-[150px]" title={pkt.destination}>
                      {pkt.destination}
                    </td>
                    <td className="py-2 px-2">
                      <span className="font-bold">{pkt.protocol}</span>
                    </td>
                    <td className="py-2 px-2 text-neutral-400">{pkt.length} B</td>
                    <td className="py-2 pl-2 pr-4 truncate max-w-[340px]" title={pkt.info}>
                      {pkt.info}
                    </td>
                  </tr>
                );
              })
            )}
            <div ref={tableEndRef} />
          </tbody>
        </table>
      </div>

      {/* Dissector Tree Details */}
      <div className="border-t border-neutral-800 bg-neutral-900/60 p-4 text-xs">
        <div className="mb-3 flex items-center justify-between text-neutral-400">
          <div className="flex items-center gap-2 font-display text-xs font-semibold text-white">
            <Icon name="layers" className="h-4 w-4 text-secondary-400" />
            <span>Detail Inspeksi Protokol (Wireshark Dissector)</span>
          </div>
          {selectedPacket && (
            <span className="font-mono text-xs text-mint">
              Paket #{selectedPacket.no} [{selectedPacket.protocol}] - {selectedPacket.length} Bytes
            </span>
          )}
        </div>

        {selectedPacket ? (
          <div className="space-y-2 font-mono text-[11px]">
            {/* Frame */}
            <details open className="group rounded-md border border-neutral-800 bg-neutral-900/80 p-2.5">
              <summary className="cursor-pointer text-neutral-200 hover:text-white select-none flex items-center gap-2">
                <Icon name="chevronRight" className="h-3.5 w-3.5 text-secondary-400 transition-transform group-open:rotate-90" />
                <span>{selectedPacket.details?.frame || `Frame ${selectedPacket.no}: ${selectedPacket.length} bytes`}</span>
              </summary>
              <div className="mt-2 pl-6 text-neutral-400 text-[10.5px] space-y-1">
                <div>Arrival Time: {selectedPacket.time} detik dari boot</div>
                <div>Interface: wlan0 (MikroTik AP SSID &apos;IQBAL&apos;)</div>
                <div>Protocols in frame: eth:ip:tcp:{selectedPacket.protocol.toLowerCase()}</div>
              </div>
            </details>

            {/* Ethernet */}
            <details open className="group rounded-md border border-neutral-800 bg-neutral-900/80 p-2.5">
              <summary className="cursor-pointer text-neutral-200 hover:text-white select-none flex items-center gap-2">
                <Icon name="chevronRight" className="h-3.5 w-3.5 text-secondary-400 transition-transform group-open:rotate-90" />
                <span>{selectedPacket.details?.ethernet || "Ethernet II, Src / Dst IEEE 802.3"}</span>
              </summary>
              <div className="mt-2 pl-6 text-neutral-400 text-[10.5px] space-y-1">
                <div>Destination MAC: Routerboard_d4:01:c3 (d4:01:c3:21:aa:90)</div>
                <div>Source MAC: Espressif_a4:12:8f (24:6f:28:a4:12:8f)</div>
                <div>Type: IPv4 (0x0800)</div>
              </div>
            </details>

            {/* IPv4 */}
            <details open className="group rounded-md border border-neutral-800 bg-neutral-900/80 p-2.5">
              <summary className="cursor-pointer text-neutral-200 hover:text-white select-none flex items-center gap-2">
                <Icon name="chevronRight" className="h-3.5 w-3.5 text-secondary-400 transition-transform group-open:rotate-90" />
                <span>{selectedPacket.details?.ip || `Internet Protocol Version 4, Src: ${selectedPacket.source}`}</span>
              </summary>
              <div className="mt-2 pl-6 text-neutral-400 text-[10.5px] space-y-1">
                <div>Source Address: {selectedPacket.source}</div>
                <div>Destination Address: {selectedPacket.destination}</div>
                <div>Header Length: 20 bytes | Time to Live: 64</div>
              </div>
            </details>

            {/* Application */}
            {selectedPacket.details?.application && (
              <details open className="group rounded-md border border-mint/30 bg-mint/5 p-2.5">
                <summary className="cursor-pointer text-mint hover:text-white select-none flex items-center gap-2">
                  <Icon name="chevronRight" className="h-3.5 w-3.5 text-mint transition-transform group-open:rotate-90" />
                  <span>Payload Lapisan Aplikasi (HTTP / Body Data)</span>
                </summary>
                <div className="mt-2 pl-6 text-mint/90 text-[10.5px] whitespace-pre-wrap bg-neutral-950 p-3 rounded border border-mint/20">
                  {selectedPacket.details.application}
                </div>
              </details>
            )}
          </div>
        ) : (
          <div className="py-6 text-center text-xs text-neutral-500 font-sans">
            Pilih baris paket di atas untuk memeriksa rincian dissector protokol.
          </div>
        )}
      </div>
    </div>
  );
}

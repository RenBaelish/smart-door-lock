"use client";

import { useEffect, useState, useRef } from "react";
import Icon, { type IconName } from "@/components/Icon";

export interface TopologyNode {
  id: string;
  name: string;
  role: string;
  ip: string;
  type: "router" | "vap" | "camera" | "server" | "admin" | "actuator";
  icon: IconName;
  x: number;
  y: number;
  status: "online" | "transmitting" | "idle" | "blocked";
  isVirtual?: boolean;
  isCurrentSession?: boolean;
  subnet?: string;
}

export interface ActivePacket {
  id: number;
  path: string[]; // sequence of node ids: e.g. ["esp32_1", "vap3", "mikrotik", "vap1", "rpi"]
  currentHop: number; // index in path (0 to path.length - 2)
  hopProgress: number; // 0 to 1
  label: string;
  protocol: "HTTP" | "TCP" | "ICMP";
  color: string;
  size: number;
  blockedAt?: string; // node ID where firewall blocks packet
  blockReason?: string;
  onFinish?: () => void;
}

const NODES: TopologyNode[] = [
  // Gateway & Central Hub
  {
    id: "mikrotik",
    name: "MikroTik hAP Router",
    role: "Gateway, Routing & Firewall Filter",
    ip: "192.168.10.1 / 20.1 / 30.1",
    type: "router",
    icon: "router",
    x: 450,
    y: 190,
    status: "online",
  },

  // 3 Virtual APs (Software-defined inside MikroTik wlan1)
  {
    id: "vap3",
    name: "Virtual-AP3 (Door-Net)",
    role: "Virtual WLAN (Bukan Fisik)",
    ip: "192.168.30.1/24",
    type: "vap",
    icon: "wifi",
    x: 250,
    y: 190,
    status: "online",
    isVirtual: true,
    subnet: "192.168.30.0/24",
  },
  {
    id: "vap1",
    name: "Virtual-AP1 (Server-Net)",
    role: "Virtual WLAN (Bukan Fisik)",
    ip: "192.168.10.1/24",
    type: "vap",
    icon: "wifi",
    x: 650,
    y: 190,
    status: "online",
    isVirtual: true,
    subnet: "192.168.10.0/24",
  },
  {
    id: "vap2",
    name: "Virtual-AP2 (Admin-Net)",
    role: "Virtual WLAN (Bukan Fisik)",
    ip: "192.168.20.1/24",
    type: "vap",
    icon: "wifi",
    x: 450,
    y: 330,
    status: "online",
    isVirtual: true,
    subnet: "192.168.20.0/24",
  },

  // Client Devices (All connect via wireless 802.11n to Virtual APs)
  {
    id: "esp32_1",
    name: "ESP32-CAM (Pintu 1)",
    role: "Kamera & Ultrasonik Kelas 1",
    ip: "192.168.30.2",
    type: "camera",
    icon: "camera",
    x: 90,
    y: 110,
    status: "online",
  },
  {
    id: "esp32_2",
    name: "ESP32-CAM (Pintu 2)",
    role: "Kamera & Ultrasonik Kelas 2",
    ip: "192.168.30.3",
    type: "camera",
    icon: "camera",
    x: 90,
    y: 270,
    status: "online",
  },
  {
    id: "rpi",
    name: "Raspberry Pi Server (8GB)",
    role: "FastAPI, PostgreSQL & Face AI",
    ip: "192.168.10.10",
    type: "server",
    icon: "server",
    x: 810,
    y: 190,
    status: "online",
  },
  {
    id: "admin",
    name: "Admin Laptop / PC",
    role: "Web Dashboard & SSH Remote",
    ip: "192.168.20.2",
    type: "admin",
    icon: "laptop",
    x: 450,
    y: 440,
    status: "online",
    isCurrentSession: true,
  },
  {
    id: "lock1",
    name: "Solenoid Kunci Pintu 1",
    role: "Aktuator Relay 5V (GPIO 27)",
    ip: "GPIO Pin 27",
    type: "actuator",
    icon: "key",
    x: 90,
    y: 35,
    status: "online",
  },
];

interface TopologyGraphProps {
  onPacketEmitted?: (packet: {
    source: string;
    destination: string;
    protocol: string;
    info: string;
    size: number;
  }) => void;
}

export default function TopologyGraph({ onPacketEmitted }: TopologyGraphProps) {
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(0.8); // slower deliberate pace
  const [activeStep, setActiveStep] = useState<string>("Sistem Siap (3 Virtual AP Aktif di MikroTik, Default-Deny Firewall ON)");
  const [activePacket, setActivePacket] = useState<ActivePacket | null>(null);
  const [firewallBlockedAlert, setFirewallBlockedAlert] = useState<{
    show: boolean;
    node: string;
    reason: string;
    packetInfo: string;
  } | null>(null);
  const [serverProcessing, setServerProcessing] = useState(false);
  const [solenoidOpen, setSolenoidOpen] = useState(false);

  const packetIdRef = useRef(1);

  // Helper to trigger sequential packet journey
  const dispatchPacketJourney = (
    path: string[],
    label: string,
    protocol: "HTTP" | "TCP" | "ICMP",
    color: string,
    size: number,
    blockedAt?: string,
    blockReason?: string,
    onFinish?: () => void
  ) => {
    const id = packetIdRef.current++;
    setActivePacket({
      id,
      path,
      currentHop: 0,
      hopProgress: 0,
      label,
      protocol,
      color,
      size,
      blockedAt,
      blockReason,
      onFinish,
    });

    const srcNode = NODES.find((n) => n.id === path[0]);
    const dstNode = NODES.find((n) => n.id === path[path.length - 1]);
    if (onPacketEmitted && srcNode && dstNode) {
      onPacketEmitted({
        source: `${srcNode.ip} (${srcNode.name})`,
        destination: `${dstNode.ip} (${dstNode.name})`,
        protocol,
        info: label,
        size,
      });
    }
  };

  // Continuous animation loop for active packet
  useEffect(() => {
    if (!isPlaying) return;

    let animId: number;
    const step = () => {
      setActivePacket((prev) => {
        if (!prev) return null;

        // Speed of movement: deliberate so user can follow
        const progressIncrement = 0.009 * speed;
        const nextProgress = prev.hopProgress + progressIncrement;

        if (nextProgress < 1) {
          return { ...prev, hopProgress: nextProgress };
        }

        // Current hop completed
        const completedNodeId = prev.path[prev.currentHop + 1];

        // Check if firewall blocked here
        if (prev.blockedAt && completedNodeId === prev.blockedAt) {
          // Packet hits firewall and is DROPPED!
          setFirewallBlockedAlert({
            show: true,
            node: completedNodeId,
            reason: prev.blockReason || "NIST SP 800-41 Rev. 1: Default-Deny rule",
            packetInfo: prev.label,
          });
          setActiveStep(`[FIREWALL DROP] Paket ${prev.label} diblokir di ${completedNodeId.toUpperCase()}!`);
          if (prev.onFinish) prev.onFinish();
          return null; // destroy packet
        }

        // More hops to travel?
        if (prev.currentHop < prev.path.length - 2) {
          return {
            ...prev,
            currentHop: prev.currentHop + 1,
            hopProgress: 0,
          };
        }

        // Packet arrived at final destination!
        if (prev.onFinish) {
          prev.onFinish();
        }
        return null;
      });

      animId = requestAnimationFrame(step);
    };

    animId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animId);
  }, [isPlaying, speed]);

  // SCENARIO 1: AKSES DIIZINKAN (Strictly Sequential Flow)
  const simulateGrantedFlow = () => {
    if (activePacket) return; // prevent overlapping race
    setFirewallBlockedAlert(null);
    setSolenoidOpen(false);

    // Stage 1: ESP32-CAM Door 1 sends HTTP POST to Raspberry Pi via Virtual-AP3 -> MikroTik -> Virtual-AP1
    setActiveStep("1. ESP32-CAM (192.168.30.2) mengambil foto wajah (~21 KB) & mengirim HTTP POST ke Server...");
    dispatchPacketJourney(
      ["esp32_1", "vap3", "mikrotik", "vap1", "rpi"],
      "HTTP POST /api/recognize [Citra Wajah ~21 KB]",
      "HTTP",
      "#ffd23d", // amber
      21500,
      undefined,
      undefined,
      () => {
        // Stage 2: Arrived at Raspberry Pi! Start processing
        setActiveStep("2. Raspberry Pi menerima citra: Menjalankan ekstraksi wajah (0.07s) & pencocokan PostgreSQL...");
        setServerProcessing(true);

        setTimeout(() => {
          setServerProcessing(false);
          setActiveStep("3. Wajah COCOK (Diizinkan)! Raspberry Pi mengirim HTTP 200 JSON Response kembali ke ESP32...");

          // Stage 3: Response departs from Raspberry Pi -> Virtual-AP1 -> MikroTik -> Virtual-AP3 -> ESP32-CAM
          dispatchPacketJourney(
            ["rpi", "vap1", "mikrotik", "vap3", "esp32_1"],
            "HTTP 200 OK [status='Diizinkan', decision=ACCEPT]",
            "HTTP",
            "#00cd8f", // mint green
            480,
            undefined,
            undefined,
            () => {
              // Stage 4: Arrived at ESP32-CAM! Trigger Solenoid
              setActiveStep("4. ESP32-CAM menerima otorisasi 200 OK: Mentrigger GPIO 27 (Solenoid Buka Pintu)...");
              setSolenoidOpen(true);

              dispatchPacketJourney(
                ["esp32_1", "lock1"],
                "GPIO 27 HIGH (Relay 5V / Solenoid Buka)",
                "TCP",
                "#00cd8f",
                64,
                undefined,
                undefined,
                () => {
                  setActiveStep("5. Siklus sukses selesai: Pintu terbuka, log akses terverifikasi disimpan.");
                  setTimeout(() => {
                    setSolenoidOpen(false);
                  }, 4000);
                }
              );
            }
          );
        }, 1200);
      }
    );
  };

  // SCENARIO 2: AKSES DITOLAK (Strictly Sequential Flow)
  const simulateDeniedFlow = () => {
    if (activePacket) return;
    setFirewallBlockedAlert(null);
    setSolenoidOpen(false);

    setActiveStep("1. ESP32-CAM (192.168.30.2) menangkap wajah orang asing & mengirim HTTP POST ke Server...");
    dispatchPacketJourney(
      ["esp32_1", "vap3", "mikrotik", "vap1", "rpi"],
      "HTTP POST /api/recognize [Wajah Tidak Terdaftar]",
      "HTTP",
      "#ffd23d",
      21000,
      undefined,
      undefined,
      () => {
        setActiveStep("2. Raspberry Pi memproses: Wajah tidak ditemukan di basis data PostgreSQL! Keputusan DITOLAK...");
        setServerProcessing(true);

        setTimeout(() => {
          setServerProcessing(false);
          setActiveStep("3. Raspberry Pi mengirimkan response HTTP 403 Forbidden kembali ke ESP32-CAM...");

          dispatchPacketJourney(
            ["rpi", "vap1", "mikrotik", "vap3", "esp32_1"],
            "HTTP 403 Forbidden [status='Ditolak', decision=DENY]",
            "HTTP",
            "#ef4444", // red
            420,
            undefined,
            undefined,
            () => {
              setActiveStep("4. ESP32-CAM menyalakan LED Merah & Buzzer. Pintu tetap TERKUNCI rapat.");
            }
          );
        }, 1200);
      }
    );
  };

  // SCENARIO 3: TAILGATING DETECTED
  const simulateTailgatingFlow = () => {
    if (activePacket) return;
    setFirewallBlockedAlert(null);
    setSolenoidOpen(false);

    setActiveStep("1. ESP32-CAM mendeteksi 2 orang bersamaan di area pintu (Multi-Face Frame)...");
    dispatchPacketJourney(
      ["esp32_1", "vap3", "mikrotik", "vap1", "rpi"],
      "HTTP POST /api/recognize [Deteksi Multi-Wajah ~38 KB]",
      "HTTP",
      "#ffd23d",
      38900,
      undefined,
      undefined,
      () => {
        setActiveStep("2. Raspberry Pi mendeteksi >1 wajah: Pelanggaran Tailgating terdeteksi! Akses diblokir.");
        setServerProcessing(true);

        setTimeout(() => {
          setServerProcessing(false);
          setActiveStep("3. Raspberry Pi mengirim peringatan tailgating ke ESP32-CAM & broadcast ke Admin...");

          dispatchPacketJourney(
            ["rpi", "vap1", "mikrotik", "vap3", "esp32_1"],
            "HTTP 403 [status='Tailgating Terdeteksi', alarm=TRUE]",
            "HTTP",
            "#f59e0b",
            480,
            undefined,
            undefined,
            () => {
              setActiveStep("4. Buzzer pintu berbunyi, pintu terkunci, dan notifikasi peringatan dikirim ke Admin.");
            }
          );
        }, 1200);
      }
    );
  };

  // SCENARIO 4: FIREWALL DROP SIMULATION (NIST SP 800-41 Default-Deny Rule)
  const simulateFirewallDrop = () => {
    if (activePacket) return;
    setFirewallBlockedAlert(null);
    setSolenoidOpen(false);

    setActiveStep("1. Uji Keamanan: Host mengirim paket ilegal (Port 23 Telnet / ICMP Ping antarsegmen tanpa izin)...");
    // Packet travels from Door-Net towards MikroTik Firewall Gateway
    dispatchPacketJourney(
      ["esp32_2", "vap3", "mikrotik"],
      "TCP SYN :23 (Telnet Scan / Unauthorized Ping)",
      "TCP",
      "#ef4444",
      128,
      "mikrotik", // BLOCKED AT MIKROTIK FIREWALL!
      "NIST SP 800-41 Rev. 1: Default-Deny Policy. Hanya Port 80 (HTTP) dan Port 22 (SSH Admin) yang diizinkan (ACCEPT). Paket ilegal langsung di-DROP di interface gateway.",
      () => {
        // Callback after drop
      }
    );
  };

  // Compute animated packet coordinates along active hop
  const getPacketCoordinates = () => {
    if (!activePacket) return null;
    const fromId = activePacket.path[activePacket.currentHop];
    const toId = activePacket.path[activePacket.currentHop + 1];
    const fromNode = NODES.find((n) => n.id === fromId);
    const toNode = NODES.find((n) => n.id === toId);
    if (!fromNode || !toNode) return null;

    const curX = fromNode.x + (toNode.x - fromNode.x) * activePacket.hopProgress;
    const curY = fromNode.y + (toNode.y - fromNode.y) * activePacket.hopProgress;
    return { x: curX, y: curY };
  };

  const pktCoords = getPacketCoordinates();
  const mikrotikNode = NODES.find((n) => n.id === "mikrotik")!;

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950 shadow-2xl">
      {/* Top Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 bg-neutral-900/90 px-6 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-secondary-500 text-neutral-950 font-bold">
              <Icon name="network" className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-base font-bold text-white">
                Simulasi Topologi Jaringan &amp; Firewall MikroTik
              </h3>
              <p className="text-xs text-neutral-400">
                Arsitektur WLAN 802.11n dengan 3 Virtual AP terisolasi &amp; Firewall NIST SP 800-41 Rev. 1
              </p>
            </div>
          </div>
        </div>

        {/* Action Trigger Buttons: Solid Primary Colors (NO OPACITY) */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={simulateGrantedFlow}
            disabled={!!activePacket}
            className="flex items-center gap-1.5 rounded-sm bg-mint px-4 py-2 text-xs font-bold text-neutral-950 shadow-md hover:bg-[#00b37c] transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="check" className="h-4 w-4" />
            Simulasi Diizinkan (200 OK)
          </button>

          <button
            type="button"
            onClick={simulateDeniedFlow}
            disabled={!!activePacket}
            className="flex items-center gap-1.5 rounded-sm bg-red-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-red-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="x" className="h-4 w-4" />
            Simulasi Ditolak (403)
          </button>

          <button
            type="button"
            onClick={simulateTailgatingFlow}
            disabled={!!activePacket}
            className="flex items-center gap-1.5 rounded-sm bg-secondary-500 px-4 py-2 text-xs font-bold text-neutral-950 shadow-md hover:bg-secondary-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="alertTriangle" className="h-4 w-4" />
            Simulasi Tailgating
          </button>

          <button
            type="button"
            onClick={simulateFirewallDrop}
            disabled={!!activePacket}
            className="flex items-center gap-1.5 rounded-sm bg-neutral-950 text-white border-2 border-red-500 px-4 py-1.5 text-xs font-bold shadow-md hover:bg-red-950/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Icon name="shield" className="h-4 w-4 text-red-500" />
            Simulasi Firewall Drop (Blokir)
          </button>

          <div className="h-5 w-px bg-neutral-700 mx-1 hidden sm:block" />

          {/* Speed Selector */}
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-mono text-neutral-400">Kecepatan:</span>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded-sm border border-neutral-700 bg-neutral-800 px-2 py-1.5 text-xs font-mono font-bold text-white focus:outline-none"
            >
              <option value={0.5}>0.5x (Lambat)</option>
              <option value={0.8}>0.8x (Normal)</option>
              <option value={1.2}>1.2x (Cepat)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Canvas Area */}
      <div className="relative bg-neutral-950 p-6 select-none">
        {/* Step Progress & Status Banner */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="flex h-2.5 w-2.5 rounded-full bg-mint animate-pulse" />
            <span className="font-semibold text-neutral-200">
              Status Aliran: <span className="font-mono text-secondary-400 font-bold">{activeStep}</span>
            </span>
          </div>

          {serverProcessing && (
            <span className="flex items-center gap-1.5 rounded-full bg-secondary-500/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-secondary-400 animate-pulse border border-secondary-500/40">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-400" />
              Raspberry Pi Komputasi Wajah (70 ms)...
            </span>
          )}

          {solenoidOpen && (
            <span className="flex items-center gap-1.5 rounded-full bg-mint/20 px-2.5 py-0.5 font-mono text-[11px] font-bold text-mint border border-mint/40">
              <Icon name="key" className="h-3 w-3" />
              Solenoid GPIO 27: PINTU TERBUKA
            </span>
          )}
        </div>

        {/* SVG Topologi Canvas (Width: 900, Height: 520) */}
        <div className="relative w-full">
          <svg viewBox="0 0 900 520" className="h-auto w-full max-h-[580px]">
            <defs>
              <pattern id="dotPattern" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="#2f3237" />
              </pattern>

              {/* Glow filter for drop & active */}
              <filter id="redGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <rect width="100%" height="100%" fill="url(#dotPattern)" />

            {/* Virtual Access Point Bounding Box (Inside MikroTik) */}
            <rect
              x="200"
              y="110"
              width="500"
              height="280"
              rx="16"
              fill="#1f2024"
              fillOpacity="0.6"
              stroke="#ffd23d"
              strokeWidth="1.5"
              strokeDasharray="6 4"
            />
            <text x="450" y="132" textAnchor="middle" fill="#ffd23d" fontSize="10.5" fontFamily="monospace" fontWeight="bold">
              [ VIRTUALISASI WLAN MIKROTIK: 3 VIRTUAL AP TERISOLASI (BUKAN PERANGKAT FISIK) ]
            </text>

            {/* Wireless WLAN IEEE 802.11n Waves from MikroTik */}
            <circle cx={mikrotikNode.x} cy={mikrotikNode.y} r="50" fill="none" stroke="#ffc400" strokeWidth="1" opacity="0.25">
              <animate attributeName="r" from="30" to="90" dur="2.5s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="2.5s" repeatCount="indefinite" />
            </circle>

            {/* Internal Virtual Links: MikroTik <-> VAPs */}
            <line x1={mikrotikNode.x} y1={mikrotikNode.y} x2={250} y2={190} stroke="#ffd23d" strokeWidth="2.5" />
            <line x1={mikrotikNode.x} y1={mikrotikNode.y} x2={650} y2={190} stroke="#ffd23d" strokeWidth="2.5" />
            <line x1={mikrotikNode.x} y1={mikrotikNode.y} x2={450} y2={330} stroke="#ffd23d" strokeWidth="2.5" />

            {/* Wireless Client Links (IEEE 802.11n Wireless Connections) */}
            {/* VAP3 -> ESP32-CAM 1 & 2 */}
            <line x1={250} y1={190} x2={90} y2={110} stroke="#4f545e" strokeWidth="1.8" strokeDasharray="4 3" />
            <line x1={250} y1={190} x2={90} y2={270} stroke="#4f545e" strokeWidth="1.8" strokeDasharray="4 3" />

            {/* VAP1 -> Raspberry Pi Server */}
            <line x1={650} y1={190} x2={810} y2={190} stroke="#00cd8f" strokeWidth="2" strokeDasharray="4 3" />

            {/* VAP2 -> Admin Laptop */}
            <line x1={450} y1={330} x2={450} y2={440} stroke="#00cd8f" strokeWidth="2" strokeDasharray="4 3" />

            {/* Hardware GPIO Wire: ESP32-CAM 1 -> Solenoid Lock 1 */}
            <line x1={90} y1={110} x2={90} y2={35} stroke="#bcc0c7" strokeWidth="2.5" />

            {/* Wireless Indicator Labels on links */}
            <g transform="translate(170, 140)">
              <rect x="-35" y="-8" width="70" height="15" rx="3" fill="#1f2024" stroke="#4f545e" strokeWidth="0.8" />
              <text textAnchor="middle" y="2" fill="#bcc0c7" fontSize="8" fontFamily="monospace">
                WLAN 802.11n
              </text>
            </g>
            <g transform="translate(730, 175)">
              <rect x="-35" y="-8" width="70" height="15" rx="3" fill="#1f2024" stroke="#00cd8f" strokeWidth="0.8" />
              <text textAnchor="middle" y="2" fill="#00cd8f" fontSize="8" fontFamily="monospace">
                WLAN 802.11n
              </text>
            </g>
            <g transform="translate(450, 390)">
              <rect x="-35" y="-8" width="70" height="15" rx="3" fill="#1f2024" stroke="#00cd8f" strokeWidth="0.8" />
              <text textAnchor="middle" y="2" fill="#00cd8f" fontSize="8" fontFamily="monospace">
                WLAN 802.11n
              </text>
            </g>

            {/* Render Nodes */}
            {NODES.map((node) => {
              const isRouter = node.id === "mikrotik";
              const isVAP = node.isVirtual;
              const isActuator = node.id === "lock1";
              const isServer = node.id === "rpi";
              const isCurrentAdmin = node.isCurrentSession;

              return (
                <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
                  {/* Outer glow or pulse */}
                  {isRouter && (
                    <circle r="38" fill="none" stroke="#ffd23d" strokeWidth="1.5" strokeDasharray="3 3">
                      <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="14s" repeatCount="indefinite" />
                    </circle>
                  )}

                  {isVAP && (
                    <circle r="28" fill="none" stroke="#ffd23d" strokeWidth="1" strokeDasharray="2 2" opacity="0.8" />
                  )}

                  {/* Main Node Shape */}
                  <circle
                    r={isRouter ? "30" : isVAP ? "24" : "22"}
                    fill={
                      isRouter
                        ? "#3d3005"
                        : isVAP
                        ? "#2f3237"
                        : isServer && serverProcessing
                        ? "#5e4a08"
                        : isCurrentAdmin
                        ? "#003b29"
                        : isActuator && solenoidOpen
                        ? "#003b29"
                        : "#2f3237"
                    }
                    stroke={
                      isRouter
                        ? "#ffd23d"
                        : isVAP
                        ? "#ffd23d"
                        : isServer && serverProcessing
                        ? "#ffd23d"
                        : isCurrentAdmin
                        ? "#00cd8f"
                        : isActuator && solenoidOpen
                        ? "#00cd8f"
                        : "#626875"
                    }
                    strokeWidth={isRouter || isVAP ? "2.5" : "2"}
                  />

                  {/* Icon */}
                  <foreignObject
                    x={isRouter ? -12 : -10}
                    y={isRouter ? -12 : -10}
                    width={isRouter ? 24 : 20}
                    height={isRouter ? 24 : 20}
                    className="pointer-events-none"
                  >
                    <div className="flex h-full w-full items-center justify-center text-white">
                      <Icon
                        name={node.icon}
                        className={
                          isRouter
                            ? "h-5 w-5 text-secondary-400"
                            : isVAP
                            ? "h-4 w-4 text-secondary-300"
                            : isServer && serverProcessing
                            ? "h-4 w-4 text-secondary-400 animate-spin"
                            : "h-4 w-4 text-white"
                        }
                      />
                    </div>
                  </foreignObject>

                  {/* Node Name */}
                  <text
                    y={isRouter ? 44 : isVAP ? 36 : 34}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={isRouter ? "12" : isVAP ? "10" : "10"}
                    fontWeight="bold"
                  >
                    {node.name}
                  </text>

                  {/* Node IP / Subnet */}
                  <text
                    y={isRouter ? 58 : isVAP ? 48 : 46}
                    textAnchor="middle"
                    fill={isVAP ? "#ffd23d" : "#bcc0c7"}
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {node.ip}
                  </text>

                  {/* Tag for Virtual AP */}
                  {isVAP && (
                    <g transform="translate(0, -32)">
                      <rect x="-42" y="-7" width="84" height="14" rx="2" fill="#ffd23d" />
                      <text textAnchor="middle" y="3" fill="#1f2024" fontSize="7.5" fontWeight="bold">
                        VIRTUAL AP (WLAN)
                      </text>
                    </g>
                  )}

                  {/* Tag for Current Session */}
                  {isCurrentAdmin && (
                    <g transform="translate(0, -32)">
                      <rect x="-45" y="-7" width="90" height="14" rx="2" fill="#00cd8f" />
                      <text textAnchor="middle" y="3" fill="#1f2024" fontSize="7.5" fontWeight="bold">
                        SESI AKTIF (LOCAL)
                      </text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* Firewall Block Indicator (At MikroTik Gateway) */}
            {firewallBlockedAlert?.show && (
              <g transform={`translate(${mikrotikNode.x}, ${mikrotikNode.y})`}>
                <circle r="44" fill="#ef4444" fillOpacity="0.2" filter="url(#redGlow)">
                  <animate attributeName="r" from="30" to="55" dur="1s" repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.8" to="0" dur="1s" repeatCount="indefinite" />
                </circle>

                {/* Drop Badge Callout */}
                <g transform="translate(0, -65)">
                  <rect x="-130" y="-22" width="260" height="44" rx="6" fill="#1f2024" stroke="#ef4444" strokeWidth="2" />
                  <text textAnchor="middle" y="-6" fill="#ef4444" fontSize="9" fontWeight="bold" fontFamily="monospace">
                    FIREWALL DROP (NIST SP 800-41 Rev. 1)
                  </text>
                  <text textAnchor="middle" y="9" fill="#ffffff" fontSize="8" fontFamily="sans-serif">
                    Paket Telnet/ICMP Ilegal di-DROP oleh Default-Deny
                  </text>
                </g>
              </g>
            )}

            {/* Animated Travelling Packet */}
            {pktCoords && activePacket && (
              <g transform={`translate(${pktCoords.x}, ${pktCoords.y})`}>
                <circle r="12" fill={activePacket.color} opacity="0.3" />
                <circle r="6" fill={activePacket.color} />
                <g transform="translate(0, -14)">
                  <rect
                    x="-38"
                    y="-9"
                    width="76"
                    height="16"
                    rx="3"
                    fill="#1f2024"
                    stroke={activePacket.color}
                    strokeWidth="1.2"
                  />
                  <text textAnchor="middle" y="2" fill="#ffffff" fontSize="8" fontFamily="monospace" fontWeight="bold">
                    {activePacket.protocol} ({activePacket.label.split(" ")[0]})
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>

        {/* Firewall Block Alert Box Explanation (Below SVG) */}
        {firewallBlockedAlert?.show && (
          <div className="mt-4 rounded-lg border-2 border-red-500 bg-red-950/40 p-4 text-white animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-600 text-white font-bold">
                <Icon name="shield" className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-red-400 text-sm">
                    PAKET DIBLOKIR: Firewall Filter Rules MikroTik (NIST SP 800-41 Rev. 1)
                  </h4>
                  <span className="rounded bg-red-600 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                    ACTION: DROP
                  </span>
                </div>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  <span className="font-semibold text-white">Alasan Blokir: </span>
                  {firewallBlockedAlert.reason}
                </p>
                <div className="pt-1 font-mono text-[11px] text-neutral-400">
                  Paket: <span className="text-red-300 font-bold">{firewallBlockedAlert.packetInfo}</span> | Titik Penyaringan: <span className="text-white">MikroTik RouterOS Forward Chain</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Legend Footer */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-6 border-t border-neutral-800 pt-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-xs border border-secondary-400 bg-secondary-500/20" />
            <span className="text-secondary-300 font-bold">Virtual AP (Software-defined)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-400" />
            <span>HTTP POST Wajah (~21 KB)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-mint" />
            <span>200 OK (Diizinkan)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" />
            <span>403 / Firewall DROP</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-secondary-500" />
            <span>Tailgating Alert</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-xs bg-[#4f545e]" />
            <span>Koneksi Nirkabel WLAN 802.11n</span>
          </div>
        </div>
      </div>
    </div>
  );
}

# Smart Door Lock — ESP32-CAM Wiring & README

## Gambaran Sistem

```
MikroTik (WLAN)
      │
      ├─── ESP32-CAM  ─── Ultrasonic ─── [ada orang?]
      │         │                               │
      │         │ HTTP POST /recognize           │ ya
      │         ▼                               ▼
      └─── Raspberry Pi           Capture → Kirim → Hasil
                │
                ▼
         Face Recognition
                │
         ┌──────┴──────┐
         ▼             ▼
       ACCEPT         DENY
         │             │
      LED Hijau   LED Merah + Buzzer
```

---

## Pin Mapping — AI-Thinker ESP32-CAM

### Peripheral yang digunakan

| Komponen        | ESP32-CAM GPIO | Konfigurasi        | Keterangan                          |
|-----------------|----------------|--------------------|-------------------------------------|
| Ultrasonic TRIG | GPIO 14        | OUTPUT             | Trigger pulse 10µs ke sensor        |
| Ultrasonic ECHO | GPIO 13        | INPUT              | Terima echo dari sensor             |
| LED Hijau       | GPIO 2         | OUTPUT             | Nyala saat ACCEPT (wajah dikenali)  |
| LED Merah       | GPIO 15        | OUTPUT             | Nyala saat DENY (tidak dikenali)    |
| Buzzer          | GPIO 12        | OUTPUT             | Bunyi saat DENY / ERROR             |
| Kamera          | Internal       | —                  | Pin kamera fixed, jangan diubah     |

### Pin kamera (JANGAN DIGUNAKAN untuk peripheral lain)

| Fungsi Kamera | GPIO | Keterangan                        |
|---------------|------|-----------------------------------|
| PWDN          | 32   | Power down kamera                 |
| XCLK          | 0    | Clock kamera (juga boot pin)      |
| SIOD (SDA)    | 26   | I2C data kamera                   |
| SIOC (SCL)    | 27   | I2C clock kamera                  |
| D0-D7         | 5,18,19,21,34,35,36,39 | Data pixels kamera  |
| VSYNC         | 25   | Vertical sync                     |
| HREF          | 23   | Horizontal reference              |
| PCLK          | 22   | Pixel clock                       |
| Flash LED     | 4    | Flash LED putih (sangat terang)   |

---

## Wiring Diagram Lengkap

```
ESP32-CAM AI-Thinker
┌───────────────────────┐
│                       │
│  GPIO 14 ─────────── TRIG ─── [HC-SR04 3.3V]
│  GPIO 13 ─────────── ECHO ─┘
│                            │
│  VCC 3.3V ──────────── VCC ┘
│  GND ───────────────── GND ┘
│
│  GPIO  2 ──[330Ω]── LED Hijau (+) ── GND
│  GPIO 15 ──[330Ω]── LED Merah (+) ── GND
│  GPIO 12 ──────────── Buzzer (+) ─── GND (aktif HIGH)
│                                     (Buzzer GND ke GND ESP32)
│
└───────────────────────┘
```

---

## Catatan Penting Per Komponen

### Sensor Ultrasonik HC-SR04

**Versi 3.3V (yang digunakan):**
- VCC → 3.3V ESP32-CAM
- GND → GND ESP32-CAM
- TRIG → GPIO 14
- ECHO → GPIO 13
- **Tidak perlu voltage divider** karena versi 3.3V sudah kompatibel

**Jika menggunakan versi 5V (JANGAN langsung hubungkan ECHO ke GPIO!):**
- ECHO menghasilkan tegangan 5V yang dapat merusak GPIO ESP32 (maks 3.3V)
- Gunakan voltage divider:
  ```
  ECHO ──[1kΩ]──┬──> GPIO 13
                │
              [2kΩ]
                │
               GND
  ```

### LED Hijau & Merah

- Selalu gunakan resistor seri untuk membatasi arus LED
- Nilai resistor: **330Ω** (untuk LED standar dengan VF ≈ 2V)
  - Arus = (3.3 - 2.0) / 330 = ~4mA (aman untuk GPIO)
- Polaritas: kaki panjang (+/anoda) ke GPIO, kaki pendek (-/katoda) ke GND

### Buzzer

- Gunakan **buzzer aktif** (yang berbunyi saat diberi tegangan)
- Bukan buzzer pasif (yang butuh sinyal PWM)
- Aktif HIGH: langsung hubungkan ke GPIO 12
- Jika buzzer 5V: gunakan transistor NPN (misalnya BC547):
  ```
  GPIO 12 ──[1kΩ]── Base BC547
  Collector BC547 ── Buzzer (−)
  Emitter BC547  ── GND
  Buzzer (+) ── 5V (dari pin VCC 5V ESP32-CAM jika ada)
  ```

---

## Catatan GPIO ESP32-CAM AI-Thinker

### GPIO yang aman digunakan setelah boot
| GPIO | Keterangan                                          |
|------|-----------------------------------------------------|
| 2    | Bootstrapping (LOW saat boot). Aman untuk output.   |
| 12   | Bootstrapping (harus LOW saat boot). Aman untuk output jika komponen tidak menarik HIGH saat power-on. |
| 13   | Aman untuk input/output                              |
| 14   | Aman untuk input/output                              |
| 15   | Ada weak pull-up internal. LED bisa sedikit redup di awal. |

### GPIO yang TIDAK BOLEH digunakan
| GPIO | Alasan                                        |
|------|-----------------------------------------------|
| 0    | Boot mode selector + XCLK kamera             |
| 1,3  | Serial TX/RX (UART0)                         |
| 4    | Flash LED putih (sangat terang)              |
| 16   | PSRAM interface                              |
| 34,35,36,39 | Input only, digunakan kamera         |
| Semua pin kamera | Lihat tabel di atas                  |

---

## Supply Power

| Koneksi       | Tegangan | Keterangan                              |
|---------------|----------|-----------------------------------------|
| VCC ESP32-CAM | 5V       | Dari USB-to-TTL atau baterai 5V         |
| 3.3V output   | 3.3V     | Untuk sensor ultrasonik versi 3.3V      |
| GND           | 0V       | Ground bersama (ESP32, sensor, LED)     |

> **Catatan:** Jangan supply ESP32-CAM dari pin 3.3V langsung (terutama saat WiFi aktif).
> ESP32-CAM membutuhkan arus peak hingga 800mA saat transmisi WiFi.
> Gunakan power supply 5V minimal 2A.

---

## Cara Upload Firmware ke ESP32-CAM

1. **Pasang jumper:** hubungkan GPIO 0 ke GND (mode flash/programming)
2. **Buka Arduino IDE**
3. **Pilih Board:** `AI Thinker ESP32-CAM`
   - Board Manager: install "esp32 by Espressif Systems"
4. **Pilih Port:** port COM yang sesuai
5. **Upload** sketch
6. **Setelah upload selesai:** lepas jumper GPIO 0
7. **Tekan tombol Reset** (EN/RST) di board

---

## Konfigurasi Sebelum Upload

Edit file `config.h` sebelum upload:

```cpp
#define WIFI_SSID     "NamaWiFiMikroTik"
#define WIFI_PASSWORD "PasswordWiFi"
#define PI_SERVER_IP  "192.168.10.10"   // IP Raspberry Pi di jaringan MikroTik
#define PI_SERVER_PORT 5000             // Port server Raspberry Pi
```

---

## Topologi Jaringan

```
MikroTik Router
  Network: 192.168.10.0/24 (contoh)
       │
       ├── WLAN ── Raspberry Pi  IP: 192.168.10.10 (static via DHCP MikroTik)
       │                         Port: 5000
       │
       └── WLAN ── ESP32-CAM     IP: 192.168.10.x  (DHCP)
                                 Client → POST ke Raspberry Pi
```

**Tips:** Set IP Raspberry Pi sebagai **DHCP Static Lease** di MikroTik agar IP tidak berubah:
- MikroTik Winbox → IP → DHCP Server → Leases → tambahkan MAC RPi → IP statis

---

## Serial Monitor Output (untuk debugging)

Buka Serial Monitor di Arduino IDE (115200 baud) untuk melihat log:

```
==============================================
  Smart Door Lock — ESP32-CAM
==============================================
[INFO] Inisialisasi kamera...
[INFO] Kamera OK
[INFO] Menghubungkan ke WiFi: NamaWiFiMikroTik
........
[INFO] WiFi berhasil terhubung!
[INFO] IP ESP32-CAM: 192.168.10.25
[INFO] Target server: http://192.168.10.10:5000
[INFO] Sistem siap. Menunggu objek...
==============================================
[INFO] Objek terdeteksi! Jarak: 34.5 cm
[INFO] Mengambil foto...
[INFO] Foto berhasil. Ukuran: 18432 bytes
[INFO] Mengirim ke Raspberry Pi...
[INFO] Response Raspberry Pi: {"status": "ACCEPT", "name": "Raffi", ...}
[INFO] ACCEPT — Selamat datang, Raffi
[AKSI] LED Hijau ON — Pintu terbuka (simulasi)
[AKSI] LED Hijau OFF
[INFO] Cooldown aktif (8 detik)
```

# Panduan Penggunaan Firmware ESP32-CAM (Smart Door Lock)

Firmware ini dirancang khusus untuk modul **AI-Thinker ESP32-CAM** yang diintegrasikan dengan sensor ultrasonik HC-SR04, layar LCD 16x2 I2C, Buzzer multi-nada, dan indikator LED untuk sistem smart door lock berbasis pengenalan wajah.

---

## 1. Skema Pengkabelan (Wiring Diagram)

| Komponen | Pin Komponen | Pin ESP32-CAM | Catatan |
| :--- | :--- | :--- | :--- |
| **LCD 16x2 I2C (PCF8574)** | VCC | 5V | Hubungkan ke sumber 5V |
| | GND | GND | Ground bersama |
| | SDA | **GPIO 13** | Jalur Data I2C |
| | SCL | **GPIO 14** | Jalur Clock I2C |
| **Sensor Ultrasonik (HC-SR04)** | VCC | 5V | Sumber daya 5V |
| | GND | GND | Ground bersama |
| | TRIG | **GPIO 15** | Pemicu pulsa ultrasonik |
| | ECHO | **GPIO 12** | Pembacaan pantulan gelombang |
| **Buzzer** | Positif (+) | **GPIO 2** | Indikator suara multi-nada |
| | Negatif (-) | GND | Ground |
| **LED Hijau (Diizinkan)** | Anoda (+) | **GPIO 4** | Indikator akses sukses (resistor 220Ω) |
| | Katoda (-) | GND | Ground |
| **LED Merah (Ditolak)** | Anoda (+) | **GPIO 3** | Indikator akses ditolak (resistor 220Ω) |
| | Katoda (-) | GND | Ground |
| **Relay Solenoid (Opsional)** | IN / Signal | **GPIO 1** | Trigger relay 5V untuk kunci pintu |

---

## 2. Persiapan Arduino IDE & Library

### A. Install Board ESP32
1. Buka Arduino IDE -> Masuk ke **File** -> **Preferences**.
2. Pada kolom *Additional Boards Manager URLs*, tambahkan:
   ```text
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Buka **Tools** -> **Board** -> **Boards Manager**.
4. Cari `esp32` (oleh Espressif Systems), lalu klik **Install**.
5. Pilih Board: **Tools** -> **Board** -> **ESP32 Arduino** -> **AI Thinker ESP32-CAM**.

### B. Install Library dari Library Manager
Buka **Sketch** -> **Include Library** -> **Manage Libraries...**, lalu cari dan install:
1. **`LiquidCrystal_I2C`** (oleh Frank de Brabander / Marco Schwartz).
2. **`ArduinoJson`** (oleh Benoît Blanchon, versi 6.x atau 7.x).

---

## 3. Menghubungkan ke Laptop Lokal (Tanpa MikroTik / Tanpa Raspberry Pi)

### Langkah 1: Hubungkan Laptop dan ESP32-CAM ke Hotspot yang Sama
- Aktifkan Hotspot HP dengan nama (SSID): `RP1` dan Password: `raffi123`.
- Sambungkan laptop Anda ke Hotspot tersebut.

### Langkah 2: Cari Alamat IP Lokal Laptop Anda
1. Di laptop Windows Anda, tekan tombol `Windows + R`, ketik `cmd`, lalu tekan **Enter**.
2. Ketik perintah:
   ```cmd
   ipconfig
   ```
3. Cari bagian **Wireless LAN adapter Wi-Fi** dan catat **IPv4 Address** (misalnya `192.168.43.150`).

### Langkah 3: Masukkan IP Laptop ke Kode Firmware
Buka file `esp32_cam_firmware.ino`, lalu sesuaikan baris:
```cpp
const char* SERVER_HOST = "192.168.43.150"; // Ganti dengan IP laptop Anda
const int   SERVER_PORT = 8000;
```

### Langkah 4: Pastikan Backend FastAPI Berjalan di Laptop
Pastikan backend berjalan di port 8000:
```bash
python main.py
```
Backend FastAPI sudah otomatis mendengarkan di `0.0.0.0:8000`, sehingga dapat diakses oleh ESP32-CAM melalui jaringan Wi-Fi lokal.

---

## 4. Jawaban atas Pertanyaan Arsitektur Jaringan

1. **Apakah frontend dan backend perlu dimasukkan IP ESP32-CAM di `.env`?**
   - **TIDAK PERLU.** Dalam arsitektur IoT, ESP32-CAM bertindak sebagai **HTTP Client** (yang memulai koneksi) dan backend bertindak sebagai **HTTP Server**. Backend tidak perlu tahu IP ESP32-CAM sebelumnya.
   - Ketika ESP32-CAM mengirim foto, backend langsung membalas statusnya dalam sesi HTTP yang sama. Web dashboard frontend otomatis menampilkan aktivitas tersebut karena backend menyimpannya ke database.

2. **Apakah ada API / Endpoint di ESP32-CAM?**
   - Endpoint ada di backend, yaitu:
     ```http
     POST /api/recognize
     Content-Type: multipart/form-data
     ```
   - ESP32-CAM bertindak sebagai pengirim (*POST request*) membawa citra JPEG kamera, dan membaca JSON balasan dari backend.

3. **Apakah ada CORS di ESP32-CAM?**
   - **TIDAK ADA.** Kebijakan CORS (*Cross-Origin Resource Sharing*) adalah mekanisme keamanan yang hanya ada dan diterapkan di dalam **Web Browser** (Chrome, Firefox, Safari). ESP32 berkomunikasi via koneksi TCP/HTTP socket murni (mikrokontroler), sehingga tidak dibatasi oleh aturan CORS browser.

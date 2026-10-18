/**
 * config.h
 * ========
 * Konfigurasi terpusat untuk ESP32-CAM Smart Door Lock.
 * Ubah nilai di file ini sesuai konfigurasi jaringan dan hardware Anda.
 *
 * CARA PENGGUNAAN:
 *   - Edit WIFI_SSID dan WIFI_PASSWORD sesuai jaringan MikroTik
 *   - Edit PI_SERVER_IP sesuai IP Raspberry Pi di jaringan MikroTik
 *   - Jangan ubah nilai lain kecuali diperlukan
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================================
//  KONFIGURASI JARINGAN (SESUAIKAN INI)
// ============================================================

// SSID WiFi MikroTik
#define WIFI_SSID         "NamaWiFiMikroTik"

// Password WiFi MikroTik
#define WIFI_PASSWORD     "PasswordWiFi"

// IP address Raspberry Pi di jaringan MikroTik
// Contoh: jika RPi mendapatkan IP 192.168.10.10
#define PI_SERVER_IP      "192.168.10.10"

// Port HTTP server Raspberry Pi (harus sama dengan SERVER_PORT di .env)
#define PI_SERVER_PORT    5000

// Endpoint face recognition di Raspberry Pi
#define RECOGNIZE_ENDPOINT "/recognize"

// ============================================================
//  PIN CONFIGURATION — AI-Thinker ESP32-CAM
// ============================================================
//
// CATATAN PENTING:
//   Pin kamera AI-Thinker menggunakan GPIO 0,4,5,18,19,21,22,23,25,26,27,32,34,35,36,39
//   GPIO berikut AMAN untuk peripheral (tidak digunakan kamera):
//   - GPIO 12: Bootstrapping pin (hindari HIGH saat boot)
//   - GPIO 13: Aman
//   - GPIO 14: Aman
//   - GPIO 15: Ada weak pull-up internal
//   - GPIO 2:  Bootstrapping pin (LOW saat boot = normal)
//
//   GPIO yang TIDAK BOLEH digunakan (dipakai kamera/flash/internal):
//   0, 1, 3, 4, 5, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33, 34, 35, 36, 39

// Ultrasonic HC-SR04 (versi 3.3V — tidak perlu voltage divider)
// TRIG → Output trigger pulse (10µs)
// ECHO → Input echo pulse (durasi = jarak)
#define TRIG_PIN          14    // GPIO 14 → Ultrasonic TRIG
#define ECHO_PIN          13    // GPIO 13 → Ultrasonic ECHO

// LED Indikator
// GREEN_LED_PIN → Menyala saat ACCEPT (wajah dikenali)
// RED_LED_PIN   → Menyala saat DENY (wajah tidak dikenali)
#define GREEN_LED_PIN     2     // GPIO 2  → LED Hijau (ACCEPT)
#define RED_LED_PIN       15    // GPIO 15 → LED Merah (DENY)

// Buzzer aktif (active HIGH) — berbunyi saat DENY atau ERROR
#define BUZZER_PIN        12    // GPIO 12 → Buzzer

// ============================================================
//  PARAMETER SENSOR ULTRASONIK
// ============================================================

// Batas jarak deteksi (cm)
// Jika jarak < DETECT_THRESHOLD_CM → ada orang → capture
// Jika jarak >= DETECT_THRESHOLD_CM → tidak ada orang → skip
#define DETECT_THRESHOLD_CM   50

// Jika sensor timeout / tidak ada echo → anggap tidak ada orang
// (terjadi saat jarak terlalu jauh / >400cm)
#define SENSOR_NO_ECHO_DISTANCE  400.0

// ============================================================
//  TIMING CONFIGURATION
// ============================================================

// Durasi LED dan Buzzer menyala setelah mendapat response (ms)
// ACCEPT: Green LED menyala selama ini
// DENY:   Red LED + Buzzer menyala selama ini
const unsigned long ACCESS_RESULT_DURATION = 3000;  // 3 detik

// Cooldown setelah capture+recognition selesai (ms)
// Selama cooldown, sensor tidak akan memicu capture baru
// Mencegah capture berulang saat orang masih di depan sensor
const unsigned long COOLDOWN_MS = 8000;  // 8 detik

// Timeout HTTP request ke Raspberry Pi (ms)
// Jika RPi tidak respond dalam waktu ini, anggap ERROR
const unsigned long HTTP_TIMEOUT_MS = 10000;  // 10 detik

// Interval baca sensor saat idle (ms)
const unsigned long SENSOR_READ_INTERVAL_MS = 300;  // 300ms

// Timeout koneksi WiFi saat boot (ms)
const unsigned long WIFI_TIMEOUT_MS = 30000;  // 30 detik

// ============================================================
//  KAMERA CONFIGURATION
// ============================================================

// Resolusi kamera untuk capture
// FRAMESIZE_QVGA = 320x240 (paling cepat, ukuran file kecil, cocok untuk recognition)
// FRAMESIZE_VGA  = 640x480 (kualitas lebih baik tapi lebih besar)
// Rekomenasi: FRAMESIZE_QVGA untuk kecepatan, FRAMESIZE_VGA untuk akurasi
#define CAPTURE_FRAMESIZE   FRAMESIZE_VGA

// Kualitas JPEG (0-63, nilai lebih rendah = kualitas lebih tinggi = file lebih besar)
#define CAPTURE_JPEG_QUALITY  10

#endif // CONFIG_H

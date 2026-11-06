/*
 * ============================================================================
 * SMART CLASSROOM DOOR LOCK - ESP32-CAM FIRMWARE (GSG 210 & GSG 211)
 * MODE TANPA LCD: SENSOR ULTRASONIK + BUZZER + LED MERAH & HIJAU
 * ============================================================================
 * ALUR KERJA:
 * 1. Sensor HC-SR04 mendeteksi objek pada jarak <= TRIGGER_DISTANCE_CM (3 cm).
 * 2. Objek harus bertahan selama COUNTDOWN_SECONDS (2 detik).
 * 3. Flash menyala -> kamera memotret -> foto dikirim ke backend FastAPI
 *    (http://SERVER_HOST:SERVER_PORT/api/recognize).
 * 4. Respons backend:
 *    - KONDISI 1 (ACCEPT)          : LED Hijau ON 5 detik + buzzer "tit-tiiit"
 *    - KONDISI 2 (Di Luar Jadwal)  : LED Merah + 2x beep sedang
 *    - KONDISI 3 (Belum Terdaftar) : LED Merah + 3x beep cepat
 *    - KONDISI 4 (>1 Orang)        : LED Merah + 5x alarm
 *    - KONDISI 5 (Tanpa Wajah/Err) : LED Merah + 1x beep panjang
 * ============================================================================
 *
 * PETA PIN ESP32-CAM (AI-THINKER) - HASIL AUDIT BEBAS BENTROK
 * ----------------------------------------------------------------------------
 * Pin yang DIPAKAI INTERNAL (JANGAN disambung apa pun):
 *   IO0  -> XCLK kamera (hanya dijumper ke GND saat UPLOAD, lalu dilepas)
 *   IO16 -> Chip Select PSRAM
 *   IO1/IO3 -> TX/RX Serial (USB-TTL / Serial Monitor)
 *   IO5,18,19,21,22,23,25,26,27,32,34,35,36,39 -> Kamera OV2640
 *   IO33 -> LED merah kecil onboard (di balik board, active LOW)
 *   IO4  -> Lampu FLASH putih onboard
 *
 * Pin BEBAS di header (karena LCD I2C & SD Card tidak dipakai):
 *   IO2, IO12, IO13, IO14, IO15  -> 5 pin = pas untuk 5 komponen di bawah.
 *
 * SAMBUNGAN (semua kaki negatif / GND ke jalur GND breadboard yang
 *            SUDAH dijumper ke pin GND ESP32-CAM):
 *   [Sensor HC-SR04]
 *     VCC  -> 5V
 *     GND  -> GND
 *     TRIG -> IO13
 *     ECHO -> IO15  (WAJIB lewat pembagi tegangan: ECHO--1k--IO15--2k--GND,
 *                    karena ECHO keluar 5V sedangkan pin ESP32 maks 3.3V)
 *   [LED Hijau]  Anoda (+, kaki panjang) -> resistor 220 ohm -> IO2
 *   [LED Merah]  Anoda (+, kaki panjang) -> resistor 220 ohm -> IO12
 *   [Buzzer]     (+) -> IO14,  (-) -> GND
 *                (Lebih aman: modul buzzer 3 kaki VCC->3V3, GND->GND, I/O->IO14,
 *                 atau buzzer lewat transistor NPN. GPIO ESP32 aman ~20 mA.)
 *   GND          -> pakai pin GND di sebelah 5V. JANGAN pakai pin "GND/R".
 *
 * KENAPA PEMBAGIAN PIN SEPERTI INI (strapping pin saat boot):
 *   IO12 wajib LOW saat boot (kalau HIGH flash jadi 1.8V -> bootloop
 *        RTCWDT_RTC_RESET). LED + resistor ke GND justru menahan IO12 tetap
 *        LOW -> AMAN. Dulu ECHO di IO12 bisa memicu bootloop.
 *   IO2  wajib LOW/mengambang saat upload. LED ke GND -> AMAN.
 *   IO15 hanya mengatur tampil/tidaknya log boot ROM. ECHO = LOW saat diam,
 *        akibatnya cuma log "ets Jul 29 2019..." tidak tampil -> AMAN.
 *   IO14 bukan strapping pin -> paling aman untuk buzzer.
 * ============================================================================
 */

#include <WiFi.h>
#include <HTTPClient.h>
#include "esp_camera.h"
#include <ArduinoJson.h>
#include "esp_wifi.h"

// ----------------------------------------------------------------------------
// [LCD I2C DINONAKTIFKAN SEMENTARA]
// Fokus pengujian: sensor, LED, buzzer. Jika nanti LCD dipakai lagi, LCD butuh
// 2 pin (SDA & SCL) sehingga harus berbagi dengan pin di atas (mis. IO14/IO15)
// dan peta pin perlu disusun ulang.
// #include <Wire.h>
// #include <LiquidCrystal_I2C.h>
// #define I2C_SDA_PIN 15
// #define I2C_SCL_PIN 14
// LiquidCrystal_I2C lcd(0x27, 16, 2);
// ----------------------------------------------------------------------------

// ============================================================================
// 1. KONFIGURASI WI-FI & IP BACKEND SERVER
// ============================================================================
// Hidden SSID MikroTik tetap bisa: cukup tulis nama SSID persis (case-sensitive).
// ESP32 hanya mendukung Wi-Fi 2.4 GHz.
const char* WIFI_SSID     = "Door-Net";
const char* WIFI_PASSWORD = "PasswordDoor";

// IP server backend FastAPI
const char* SERVER_HOST   = "192.168.10.10";
const int   SERVER_PORT   = 8000;

// Parameter pengujian
String roomId             = "GSG210";
bool   bypassSchedule     = true;   // true = abaikan jadwal (wajah terdaftar langsung ACCEPT)
bool   useFlashOnCapture  = true;   // flash menyala saat capture
bool   enableUltrasonic   = true;   // deteksi otomatis sensor
bool   printLiveSensorLog = true;   // log jarak tiap 1 detik

const float TRIGGER_DISTANCE_CM = 15.0f;  // Memicu hitung mundur jika jarak <= 5.0 cm
const float CANCEL_DISTANCE_CM  = 20.0f;  // Hitung mundur batal jika objek menjauh > 8.0 cm
const int   COUNTDOWN_SECONDS   = 2;
const int   UNLOCK_DURATION_MS  = 5000;

// ============================================================================
// 2. PIN KAMERA OV2640 (AI-THINKER) - JANGAN DIUBAH
// ============================================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================================================
// 3. PIN PERANGKAT LUAR (SETIAP PIN HANYA DIPAKAI 1 KOMPONEN)
// ============================================================================
#define TRIG_PIN          13  // IO13 -> TRIG HC-SR04
#define ECHO_PIN          15  // IO15 -> ECHO HC-SR04 (lewat pembagi tegangan)
#define LED_GREEN_PIN      2  // IO2  -> LED Hijau (+ resistor 220 ohm)
#define LED_RED_PIN       12  // IO12 -> LED Merah (+ resistor 220 ohm)
#define BUZZER_PIN        14  // IO14 -> Buzzer (+)
#define FLASH_LED_PIN      4  // IO4  -> Flash onboard
#define ONBOARD_RED_LED   33  // IO33 -> LED kecil onboard (active LOW)

// Tipe buzzer:
//   useActiveBuzzer = true  -> buzzer AKTIF (cukup diberi HIGH, bunyi sendiri)
//   useActiveBuzzer = false -> buzzer PASIF (perlu sinyal nada ~2.5 kHz)
// Logika modul:
//   BUZZER_ACTIVE_LOW = false -> bunyi saat pin HIGH (buzzer 2 kaki biasa)
//   BUZZER_ACTIVE_LOW = true  -> bunyi saat pin LOW  (banyak modul 3 kaki "low level trigger")
// PENTING: set sesuai buzzer fisik yang dipasang. Jika modul Anda active-LOW
// tapi di sini false, buzzer akan bunyi terus sejak menyala (tekan 'i' untuk balik).
bool useActiveBuzzer = true;
bool BUZZER_ACTIVE_LOW = false;

// Flash pakai PWM agar arus lebih kecil (mengurangi risiko brownout & foto silau).
// Kamera memakai LEDC channel 0 / timer 0, jadi flash pakai channel 2 (timer 1).
#define FLASH_PWM_CHANNEL  2
#define FLASH_PWM_FREQ     5000
#define FLASH_PWM_RES      8      // 0-255
int flashBrightness = 60;         // ~25% kecerahan. Naikkan jika foto terlalu gelap.

void flashOn()  { ledcWrite(FLASH_LED_PIN, flashBrightness); }
void flashOff() { ledcWrite(FLASH_LED_PIN, 0); }

unsigned long lastSensorLogMs = 0;

// ============================================================================
// 4. LED & BUZZER
// ============================================================================
void setDoorLedState(bool greenOn, bool redOn) {
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(ONBOARD_RED_LED, OUTPUT);

  digitalWrite(LED_GREEN_PIN, greenOn ? HIGH : LOW);
  digitalWrite(LED_RED_PIN,   redOn   ? HIGH : LOW);
  digitalWrite(ONBOARD_RED_LED, redOn ? LOW : HIGH); // onboard red LED (active LOW)
}

inline void buzzerWrite(bool on) {
  bool level = BUZZER_ACTIVE_LOW ? !on : on;
  digitalWrite(BUZZER_PIN, level ? HIGH : LOW);
}

void beepBuzzer(int durationMs) {
  if (useActiveBuzzer) {
    buzzerWrite(true);
    delay(durationMs);
    buzzerWrite(false);
  } else {
    // Buzzer pasif: osilasi ~2500 Hz (200us ON / 200us OFF)
    unsigned long start = millis();
    while (millis() - start < (unsigned long)durationMs) {
      buzzerWrite(true);
      delayMicroseconds(200);
      buzzerWrite(false);
      delayMicroseconds(200);
    }
    buzzerWrite(false);
  }
}

// KONDISI 1 (ACCEPT): tit - tiiit
void buzzerCondition1_Success() {
  beepBuzzer(120);
  delay(90);
  beepBuzzer(300);
}

// KONDISI 2 (out_of_schedule): 2x beep sedang
void buzzerCondition2_OutOfSchedule() {
  for (int i = 0; i < 2; i++) { beepBuzzer(250); delay(150); }
}

// KONDISI 3 (unregistered/invalid): 3x beep cepat
void buzzerCondition3_Unregistered() {
  for (int i = 0; i < 3; i++) { beepBuzzer(150); delay(100); }
}

// KONDISI 4 (tailgating): 5x alarm
void buzzerCondition4_Tailgating() {
  for (int i = 0; i < 5; i++) { beepBuzzer(90); delay(70); }
}

// KONDISI 5 (no_face / error): 1x beep panjang
void buzzerCondition5_NoFace() {
  beepBuzzer(600);
}

// ============================================================================
// 5. SENSOR ULTRASONIK HC-SR04
// ============================================================================
// Return jarak dalam cm, atau 999 jika tidak ada pantulan.
float readSingleUltrasonicOnce() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Timeout 12 ms (~2 meter). Cukup untuk jarak trigger kecil & membuat loop lebih responsif.
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 12000UL);
  if (duration == 0) return 999.0f;

  float cm = (duration * 0.0343f) / 2.0f;
  if (cm < 0.4f) return 999.0f; // glitch
  return cm;
}

float readUltrasonicDistanceCm() {
  for (int attempt = 0; attempt < 3; attempt++) {
    float d = readSingleUltrasonicOnce();
    if (d < 999.0f) return d;
    delay(10);
  }
  return 999.0f;
}

// ============================================================================
// 6. COUNTDOWN 2 DETIK SEBELUM CAPTURE
// ============================================================================
bool runCountdownBeforeCapture() {
  Serial.printf("\n[SENSOR] Objek <= %.1f cm! Tahan %d detik...\n", TRIGGER_DISTANCE_CM, COUNTDOWN_SECONDS);

  for (int sec = COUNTDOWN_SECONDS; sec >= 1; sec--) {
    Serial.printf("  -> [%d] jarak: %.1f cm\n", sec, readUltrasonicDistanceCm());
    for (int step = 0; step < 2; step++) {
      delay(480);
      float d = readUltrasonicDistanceCm();
      if (d > CANCEL_DISTANCE_CM) {
        Serial.printf("  -> [BATAL] Objek menjauh (%.1f cm). Capture dibatalkan.\n\n", d);
        return false;
      }
    }
  }
  Serial.println("  -> [POSISI PAS] Capture dengan flash...");
  return true;
}

// ============================================================================
// 7. CAPTURE & KIRIM KE BACKEND
// ============================================================================
void captureAndVerifyFace() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[ERROR] Wi-Fi terputus! Mencoba menghubungkan kembali...");
    connectToWiFiNetwork();
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("[ERROR] Masih belum terhubung ke Wi-Fi. Ketik 'w' untuk konek ulang.");
      buzzerCondition5_NoFace();
      return;
    }
  }

  Serial.println("\n================================================================");
  Serial.printf("[ESP32-CAM %s] Mengambil foto...\n", roomId.c_str());

  if (useFlashOnCapture) { flashOn(); delay(150); }

  // Buang 1 frame lama agar foto terbaru & terang
  camera_fb_t* old_fb = esp_camera_fb_get();
  if (old_fb) esp_camera_fb_return(old_fb);
  if (useFlashOnCapture) delay(50);

  camera_fb_t* fb = esp_camera_fb_get();
  if (useFlashOnCapture) flashOff();

  if (!fb) {
    Serial.println("[ERROR] Gagal mengambil frame kamera!");
    buzzerCondition5_NoFace();
    return;
  }

  String url = String("http://") + SERVER_HOST + ":" + String(SERVER_PORT) +
               "/api/recognize?room=" + roomId +
               "&bypass_schedule=" + (bypassSchedule ? "true" : "false") +
               "&is_simulation=false";
  Serial.printf("[HTTP POST] %u bytes -> %s\n", fb->len, url.c_str());
  unsigned long startMs = millis();

  String boundary = "----FaceLockESP32CamBoundary";
  String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  uint32_t totalLen = head.length() + fb->len + tail.length();
  uint8_t* payloadBuf = (uint8_t*)malloc(totalLen);
  if (!payloadBuf) {
    Serial.println("[ERROR] Memori buffer HTTP tidak cukup!");
    esp_camera_fb_return(fb);
    return;
  }
  memcpy(payloadBuf, head.c_str(), head.length());
  memcpy(payloadBuf + head.length(), fb->buf, fb->len);
  memcpy(payloadBuf + head.length() + fb->len, tail.c_str(), tail.length());
  esp_camera_fb_return(fb);

  WiFiClient client;
  HTTPClient http;
  http.begin(client, url);
  http.setTimeout(10000);
  http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);

  int httpCode = http.POST(payloadBuf, totalLen);
  free(payloadBuf);
  unsigned long elapsedMs = millis() - startMs;

  if (httpCode > 0) {
    String responseBody = http.getString();
    Serial.printf("[HTTP %d] Respons diterima dalam %lu ms\n", httpCode, elapsedMs);

    StaticJsonDocument<1536> doc;
    DeserializationError err = deserializeJson(doc, responseBody);

    if (!err) {
      String status     = doc["status"]     | "invalid";
      String decision   = doc["decision"]   | "DENY";
      String name       = doc["name"]       | "Tidak Terdaftar";
      String role       = doc["role"]       | "-";
      String nim        = doc["nim"]        | "-";
      String kelas      = doc["kelas"]      | "-";
      String room       = doc["room"]       | roomId;
      String subject    = doc["subject"]    | "-";
      String lecturer   = doc["lecturer"]   | "-";
      String startTime  = doc["start_time"] | "--:--";
      String endTime    = doc["end_time"]   | "--:--";
      String day        = doc["day"]        | "-";
      String wibTime    = doc["wib_time"]   | "--:--:--";
      String reason     = doc["reason"]     | "-";
      float distance    = doc["distance"]   | -1.0f;
      int facesDetected = doc["faces_detected"] | 0;
      int logId         = doc["log_id"]     | 0;

      Serial.println("\n---------------- HASIL VERIFIKASI ----------------");
      Serial.printf("  ID Log Web      : #%d\n", logId);
      Serial.printf("  Keputusan       : %s (Status: %s)\n", decision.c_str(), status.c_str());
      Serial.printf("  Ruangan         : %s\n", room.c_str());
      Serial.printf("  Jumlah Wajah    : %d\n", facesDetected);
      Serial.printf("  Nama            : %s (%s)\n", name.c_str(), role.c_str());
      Serial.printf("  NIM / NIP       : %s\n", nim.c_str());
      Serial.printf("  Kelas           : %s\n", kelas.c_str());
      Serial.printf("  Mata Kuliah     : %s\n", subject.c_str());
      Serial.printf("  Dosen           : %s\n", lecturer.c_str());
      Serial.printf("  Jadwal          : %s - %s WIB (%s)\n", startTime.c_str(), endTime.c_str(), day.c_str());
      Serial.printf("  Waktu Scan      : %s WIB | Jarak L2: %.4f\n", wibTime.c_str(), distance);
      Serial.printf("  Alasan          : %s\n", reason.c_str());

      if (decision == "ACCEPT" || status == "success") {
        Serial.println("  Hardware        : [KONDISI 1 - DIIZINKAN] LED HIJAU ON (5 dtk) & Buzzer Sukses");
        setDoorLedState(true, false); // LED Hijau ON, LED Merah OFF
        buzzerCondition1_Success();   // Buzzer tit - tiiit!
        delay(UNLOCK_DURATION_MS);    // Tahan pintu terbuka 5 detik
        setDoorLedState(false, true); // Kembali standby (LED Merah ON, LED Hijau OFF)
        Serial.println("[STANDBY] Pintu terkunci kembali (LED Merah ON, Hijau OFF).");
      } else {
        // KONDISI DITOLAK (DENY): Kedipkan LED Merah bersamaan dengan nada Buzzer!
        if (status == "out_of_schedule") {
          Serial.println("  Hardware        : [KONDISI 2 - DI LUAR JADWAL] 2x Beep & LED Merah Kedip");
          for (int i = 0; i < 2; i++) {
            setDoorLedState(false, true);
            beepBuzzer(250);
            setDoorLedState(false, false);
            delay(150);
          }
        } else if (status == "invalid" || status == "unregistered") {
          Serial.println("  Hardware        : [KONDISI 3 - BELUM TERDAFTAR] 3x Beep & LED Merah Kedip");
          for (int i = 0; i < 3; i++) {
            setDoorLedState(false, true);
            beepBuzzer(150);
            setDoorLedState(false, false);
            delay(100);
          }
        } else if (status == "tailgating") {
          Serial.println("  Hardware        : [KONDISI 4 - >1 ORANG] 5x Alarm & LED Merah Kedip Cepat");
          for (int i = 0; i < 5; i++) {
            setDoorLedState(false, true);
            beepBuzzer(90);
            setDoorLedState(false, false);
            delay(70);
          }
        } else {
          Serial.println("  Hardware        : [KONDISI 5 - TANPA WAJAH] 1x Beep Panjang & LED Merah");
          setDoorLedState(false, true);
          buzzerCondition5_NoFace();
        }
        setDoorLedState(false, true); // Pastikan kembali ke Standby (LED Merah ON diam)
      }
      Serial.println("--------------------------------------------------");
    } else {
      Serial.printf("[ERROR] JSON tidak valid: %s\n", err.c_str());
      buzzerCondition5_NoFace();
    }
  } else {
    Serial.printf("[HTTP ERROR] (%d): %s\n", httpCode, http.errorToString(httpCode).c_str());
    Serial.println("  -> Cek: backend jalan? IP benar? firewall MikroTik izinkan port 8000?");
    buzzerCondition5_NoFace();
  }

  http.end();
  Serial.printf("\n[SIAP] Dekatkan objek <= %.1f cm atau ketik 'c'...\n", TRIGGER_DISTANCE_CM);
}

// ============================================================================
// 8. WI-FI (MENDUKUNG HIDDEN SSID & VIRTUAL AP MIKROTIK)
// ============================================================================
void connectToWiFiNetwork() {
  Serial.printf("\n[WI-FI] Menghubungkan ke SSID '%s' (Mendukung Hidden SSID MikroTik)...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.disconnect(true);
  delay(200);

  // 1. Konfigurasi ESP-IDF Wi-Fi STA agar aktif memindai semua kanal 2.4 GHz
  wifi_config_t conf;
  if (esp_wifi_get_config(WIFI_IF_STA, &conf) == ESP_OK) {
    conf.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;
    conf.sta.sort_method = WIFI_CONNECT_AP_BY_SIGNAL;
    esp_wifi_set_config(WIFI_IF_STA, &conf);
  }

  // 2. Active Probe Scan untuk memancing respons beacon dari Hidden SSID MikroTik
  Serial.println("[WI-FI] Memindai kanal 2.4 GHz untuk mendeteksi AP MikroTik...");
  int n = WiFi.scanNetworks(false, true); // true = active probe scan for hidden networks
  int targetChannel = 0;
  uint8_t targetBSSID[6];
  bool found = false;

  for (int i = 0; i < n; i++) {
    if (WiFi.SSID(i) == WIFI_SSID) {
      targetChannel = WiFi.channel(i);
      memcpy(targetBSSID, WiFi.BSSID(i), 6);
      found = true;
      Serial.printf("  -> Ditemukan AP '%s' [Kanal %d, BSSID: %s, Sinyal: %d dBm]\n",
                    WIFI_SSID, targetChannel, WiFi.BSSIDstr(i).c_str(), WiFi.RSSI(i));
      break;
    }
  }

  if (found) {
    Serial.println("  -> Mengunci koneksi langsung ke Channel & BSSID AP MikroTik...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD, targetChannel, targetBSSID);
  } else {
    Serial.println("  -> Mengirim Probe Request langsung ke AP MikroTik...");
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  }

  int retry = 0;
  while (WiFi.status() != WL_CONNECTED && retry < 40) { // Timeout 20 detik
    delay(500);
    Serial.print(".");
    retry++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WI-FI TERHUBUNG KE MIKROTIK]");
    Serial.printf("  IP ESP32-CAM : %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("  Gateway      : %s\n", WiFi.gatewayIP().toString().c_str());
    Serial.printf("  Subnet Mask  : %s\n", WiFi.subnetMask().toString().c_str());
    Serial.printf("  RSSI Sinyal  : %d dBm\n", WiFi.RSSI());
  } else {
    Serial.println("\n[WI-FI GAGAL] Tidak dapat terhubung ke MikroTik!");
    Serial.printf("  Status Eror Kode: %d\n", WiFi.status());
    Serial.println("  Panduan Cek MikroTik:");
    Serial.println("   1. Security Profile: WPA2-PSK saja (Centang AES-CCM, UNCHECK TKIP/WPA1/WPA3).");
    Serial.println("   2. Virtual AP: Pastikan 'Default Authentication' tercentang (YES).");
    Serial.println("   3. Master wlan1: Pastikan Channel Width = 20MHz (bukan 40MHz).");
    Serial.println("   4. Virtual AP: Pastikan DHCP Server aktif pada interface V-AP.");
    Serial.println("   5. Buka menu Log di Winbox untuk melihat alasan disconnect.");
  }
}

// ============================================================================
// 9. TES HARDWARE SATU PER SATU
// ============================================================================
void testAllHardware() {
  Serial.println("\n[TES HARDWARE] Perhatikan tiap komponen:");

  Serial.printf("  1. LED HIJAU (IO%d) ON 1 detik\n", LED_GREEN_PIN);
  setDoorLedState(true, false); delay(1000);

  Serial.printf("  2. LED MERAH (IO%d) ON 1 detik\n", LED_RED_PIN);
  setDoorLedState(false, true); delay(1000);

  Serial.printf("  3. BUZZER (IO%d) bunyi 1 detik [mode %s, %s]\n", BUZZER_PIN,
                useActiveBuzzer ? "AKTIF" : "PASIF", BUZZER_ACTIVE_LOW ? "active-LOW" : "active-HIGH");
  beepBuzzer(1000); delay(300);

  Serial.printf("  4. FLASH (IO%d) ON 0.3 detik (kecerahan %d/255)\n", FLASH_LED_PIN, flashBrightness);
  flashOn(); delay(300); flashOff();

  float d = readUltrasonicDistanceCm();
  Serial.printf("  5. SENSOR (TRIG IO%d, ECHO IO%d): ", TRIG_PIN, ECHO_PIN);
  if (d >= 999.0f) Serial.println("TIDAK ADA PANTULAN -> cek kabel/pembagi tegangan ECHO");
  else             Serial.printf("%.1f cm -> OK\n", d);

  setDoorLedState(false, true);
  Serial.println("[TES HARDWARE SELESAI]\n");
}

// ============================================================================
// 10. MENU SERIAL MONITOR
// ============================================================================
void printHelpMenu() {
  String ip = (WiFi.status() == WL_CONNECTED) ? WiFi.localIP().toString() : String("BELUM TERHUBUNG");

  Serial.println("\n================ MENU SMART DOOR LOCK ESP32-CAM (TANPA LCD) ================");
  Serial.printf("  IP ESP32-CAM   : %s\n", ip.c_str());
  Serial.printf("  Target Server  : http://%s:%d/api/recognize\n", SERVER_HOST, SERVER_PORT);
  Serial.printf("  Ruang          : %s\n", roomId.c_str());
  Serial.printf("  Bypass Jadwal  : %s\n", bypassSchedule ? "ON" : "OFF");
  Serial.printf("  Sensor         : %s | TRIG=IO%d ECHO=IO%d | trigger <= %.1f cm, tahan %d dtk\n",
                enableUltrasonic ? "ON" : "OFF", TRIG_PIN, ECHO_PIN, TRIGGER_DISTANCE_CM, COUNTDOWN_SECONDS);
  Serial.printf("  LED            : HIJAU=IO%d  MERAH=IO%d\n", LED_GREEN_PIN, LED_RED_PIN);
  Serial.printf("  Buzzer         : IO%d | %s | %s\n", BUZZER_PIN,
                useActiveBuzzer ? "AKTIF (DC)" : "PASIF (nada)", BUZZER_ACTIVE_LOW ? "active-LOW" : "active-HIGH");
  Serial.printf("  Flash          : IO%d | %s\n", FLASH_LED_PIN, useFlashOnCapture ? "ON" : "OFF");
  Serial.println("----------------------------------------------------------------------------");
  Serial.println("  c -> Capture manual & kirim ke backend");
  Serial.println("  h -> Tes semua hardware satu per satu (LED, buzzer, flash, sensor)");
  Serial.println("  t -> Tes buzzer 1 detik");
  Serial.println("  z -> Tes pola buzzer kondisi 1-5");
  Serial.println("  m -> Ganti tipe buzzer (AKTIF <-> PASIF)");
  Serial.println("  i -> Balik logika buzzer (active-HIGH <-> active-LOW)");
  Serial.println("  g -> Tes LED hijau (ACCEPT) 2 detik");
  Serial.println("  r -> Tes LED merah 2 detik");
  Serial.println("  d -> Log jarak live ON/OFF");
  Serial.println("  s -> Deteksi otomatis sensor ON/OFF");
  Serial.println("  b -> Bypass jadwal ON/OFF");
  Serial.println("  f -> Flash saat capture ON/OFF");
  Serial.println("  w -> Konek ulang Wi-Fi");
  Serial.println("  1 / 2 -> Pilih ruang GSG210 / GSG211");
  Serial.println("  ? -> Tampilkan menu ini");
  Serial.println("============================================================================\n");
}

// ============================================================================
// 11. SETUP
// ============================================================================
void setup() {
  // Set semua output ke kondisi aman SEDINI MUNGKIN (sebelum kamera/Wi-Fi)
  pinMode(BUZZER_PIN, OUTPUT);
  buzzerWrite(false);
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  pinMode(ONBOARD_RED_LED, OUTPUT);
  pinMode(FLASH_LED_PIN, OUTPUT);
  digitalWrite(FLASH_LED_PIN, LOW);
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_PIN, INPUT);
  setDoorLedState(false, true);

  Serial.begin(115200);
  delay(300);
  Serial.println("\n[SISTEM] Smart Door Lock ESP32-CAM (Sensor + Buzzer + 2 LED)");

  // Kamera OV2640
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;
  if (psramFound()) {
    // PSRAM 4MB tersedia: foto lebih besar & tidak memakan RAM internal (Wi-Fi/HTTP)
    config.frame_size   = FRAMESIZE_VGA;   // 640x480, lebih akurat untuk face recognition
    config.jpeg_quality = 10;
    config.fb_count     = 2;
    config.fb_location  = CAMERA_FB_IN_PSRAM;
    config.grab_mode    = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size   = FRAMESIZE_QVGA;  // 320x240
    config.jpeg_quality = 12;
    config.fb_count     = 1;
    config.fb_location  = CAMERA_FB_IN_DRAM;
    config.grab_mode    = CAMERA_GRAB_WHEN_EMPTY;
  }

  if (esp_camera_init(&config) != ESP_OK) {
    Serial.println("[FATAL] Kamera gagal init! Cek kabel pita kamera.");
    while (true) { buzzerCondition5_NoFace(); delay(3000); }
  }
  Serial.printf("[OK] Kamera siap. PSRAM: %s, resolusi: %s\n",
                psramFound() ? "ADA" : "TIDAK ADA", psramFound() ? "VGA 640x480" : "QVGA 320x240");

  // Flash PWM di channel 2 (tidak bentrok dengan XCLK kamera di channel 0)
  if (!ledcAttachChannel(FLASH_LED_PIN, FLASH_PWM_FREQ, FLASH_PWM_RES, FLASH_PWM_CHANNEL)) {
    Serial.println("[WARN] PWM flash gagal, flash tidak akan menyala.");
  }
  flashOff();

  // Bunyi 2x singkat = buzzer berfungsi
  beepBuzzer(100); delay(120); beepBuzzer(100);

  connectToWiFiNetwork();
  printHelpMenu();
  Serial.printf("[SIAP] Dekatkan objek <= %.1f cm atau ketik 'c'...\n", TRIGGER_DISTANCE_CM);
}

// ============================================================================
// 12. LOOP
// ============================================================================
void loop() {
  while (Serial.available() > 0) {
    char ch = Serial.read();
    if (ch == '\r' || ch == '\n' || ch == ' ') continue;

    switch (ch) {
      case 'c': case 'C':
        Serial.println("\n[MANUAL] Capture...");
        captureAndVerifyFace();
        break;
      case 'h': case 'H':
        testAllHardware();
        break;
      case 't': case 'T':
        Serial.printf("\n[TES BUZZER] IO%d 1 detik...\n", BUZZER_PIN);
        beepBuzzer(1000);
        Serial.println("  Tidak bunyi? coba 'm' (ganti aktif/pasif) atau 'i' (balik logika).");
        break;
      case 'z': case 'Z':
        Serial.println("\n[TES POLA BUZZER]");
        Serial.println("  Kondisi 1 (ACCEPT)");          buzzerCondition1_Success();        delay(800);
        Serial.println("  Kondisi 2 (Di luar jadwal)");  buzzerCondition2_OutOfSchedule();  delay(800);
        Serial.println("  Kondisi 3 (Belum terdaftar)"); buzzerCondition3_Unregistered();   delay(800);
        Serial.println("  Kondisi 4 (>1 orang)");        buzzerCondition4_Tailgating();     delay(800);
        Serial.println("  Kondisi 5 (Tanpa wajah)");     buzzerCondition5_NoFace();
        Serial.println("[SELESAI]");
        break;
      case 'm': case 'M':
        useActiveBuzzer = !useActiveBuzzer;
        buzzerWrite(false);
        Serial.printf("\n[INFO] Tipe buzzer: %s\n", useActiveBuzzer ? "AKTIF (DC)" : "PASIF (nada)");
        break;
      case 'i': case 'I':
        BUZZER_ACTIVE_LOW = !BUZZER_ACTIVE_LOW;
        buzzerWrite(false);
        Serial.printf("\n[INFO] Logika buzzer: %s\n", BUZZER_ACTIVE_LOW ? "active-LOW" : "active-HIGH");
        break;
      case 'g': case 'G':
        Serial.println("\n[TES] LED HIJAU 2 detik");
        setDoorLedState(true, false); delay(2000); setDoorLedState(false, true);
        break;
      case 'r': case 'R':
        Serial.println("\n[TES] LED MERAH berkedip 2 detik");
        for (int k = 0; k < 4; k++) {
          setDoorLedState(false, false); delay(250);
          setDoorLedState(false, true);  delay(250);
        }
        break;
      case 'd': case 'D':
        printLiveSensorLog = !printLiveSensorLog;
        Serial.printf("\n[INFO] Log jarak live: %s\n", printLiveSensorLog ? "ON" : "OFF");
        break;
      case 's': case 'S':
        enableUltrasonic = !enableUltrasonic;
        Serial.printf("\n[INFO] Deteksi sensor: %s\n", enableUltrasonic ? "ON" : "OFF");
        break;
      case 'b': case 'B':
        bypassSchedule = !bypassSchedule;
        Serial.printf("\n[INFO] Bypass jadwal: %s\n", bypassSchedule ? "ON" : "OFF");
        break;
      case 'f': case 'F':
        useFlashOnCapture = !useFlashOnCapture;
        Serial.printf("\n[INFO] Flash capture: %s\n", useFlashOnCapture ? "ON" : "OFF");
        break;
      case 'w': case 'W':
        connectToWiFiNetwork();
        break;
      case '1':
        roomId = "GSG210";
        Serial.println("\n[INFO] Ruang: GSG210");
        break;
      case '2':
        roomId = "GSG211";
        Serial.println("\n[INFO] Ruang: GSG211");
        break;
      default:
        printHelpMenu();
        break;
    }
  }

  if (enableUltrasonic) {
    float distCm = readUltrasonicDistanceCm();

    if (printLiveSensorLog && (millis() - lastSensorLogMs >= 1000)) {
      lastSensorLogMs = millis();
      if (distCm >= 999.0f) Serial.println("[SENSOR] Tidak ada pantulan");
      else                  Serial.printf("[SENSOR] %.1f cm (trigger <= %.1f cm)\n", distCm, TRIGGER_DISTANCE_CM);
    }

    if (distCm <= TRIGGER_DISTANCE_CM) {
      if (runCountdownBeforeCapture()) {
        captureAndVerifyFace();
        delay(2000); // jeda sebelum deteksi berikutnya
      }
    }
  }

  delay(60);
}

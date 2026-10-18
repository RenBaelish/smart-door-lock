/**
 * esp32_cam.ino
 * =============
 * Smart Door Lock — ESP32-CAM Firmware
 *
 * ARSITEKTUR:
 *   ESP32-CAM (HTTP Client)  →  Raspberry Pi (HTTP Server)
 *   ESP32 BUKAN server. ESP32 mengirim image ke Raspberry Pi.
 *
 * ALUR UTAMA:
 *   Boot → Connect WiFi → Loop:
 *     Baca Ultrasonic
 *     Jika jarak < threshold dan cooldown selesai:
 *       Capture foto
 *       HTTP POST ke Raspberry Pi /recognize
 *       Parse response JSON
 *       ACCEPT → LED Hijau (3 detik)
 *       DENY   → LED Merah + Buzzer (3 detik)
 *       ERROR  → LED Merah blink
 *       Cooldown (8 detik)
 *
 * HARDWARE (AI-Thinker ESP32-CAM):
 *   - GPIO 14 → Ultrasonic TRIG
 *   - GPIO 13 → Ultrasonic ECHO (sensor 3.3V, tidak perlu voltage divider)
 *   - GPIO  2 → LED Hijau (ACCEPT)
 *   - GPIO 15 → LED Merah (DENY)
 *   - GPIO 12 → Buzzer
 *
 * DEPENDENSI:
 *   - Board: ESP32 by Espressif (install di Arduino IDE Board Manager)
 *   - Library: esp_camera (sudah include di ESP32 Arduino package)
 *   - Library: WiFi (sudah include)
 *   - Tidak butuh library tambahan
 *
 * CARA UPLOAD:
 *   1. Pasang jumper GPIO 0 ke GND (boot mode)
 *   2. Upload melalui Arduino IDE
 *   3. Lepas jumper GPIO 0
 *   4. Tekan tombol Reset di ESP32-CAM
 */

#include "config.h"
#include "esp_camera.h"
#include <WiFi.h>

// ============================================================
//  PIN KAMERA — AI-Thinker ESP32-CAM
//  JANGAN UBAH INI — PIN KAMERA SUDAH FIXED DI HARDWARE
// ============================================================
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1    // tidak ada pin reset
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

// ============================================================
//  STATE VARIABLES
// ============================================================

// Waktu capture terakhir (untuk cooldown)
unsigned long lastCaptureTime = 0;

// Status cooldown: true = masih dalam cooldown, tidak boleh capture
bool isCooldown = false;

// ============================================================
//  FORWARD DECLARATIONS
// ============================================================
bool initCamera();
float readUltrasonicDistance();
bool sendImageToRaspberryPi(camera_fb_t* fb);
void handleAccept();
void handleDeny();
void handleError();
void ledBlink(int pin, int times, int onMs, int offMs);
void allLedsOff();
void reconnectWiFi();


// ============================================================
//  SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  Serial.println("\n\n");
  Serial.println("==============================================");
  Serial.println("  Smart Door Lock — ESP32-CAM");
  Serial.println("==============================================");

  // ── Setup pin LED dan Buzzer ──────────────────────────────
  // LED dan buzzer harus LOW saat boot untuk menghindari masalah bootstrapping
  pinMode(GREEN_LED_PIN, OUTPUT);
  pinMode(RED_LED_PIN,   OUTPUT);
  pinMode(BUZZER_PIN,    OUTPUT);
  allLedsOff();

  // ── Setup pin Ultrasonic ──────────────────────────────────
  // TRIG = OUTPUT untuk mengirim pulse trigger
  // ECHO = INPUT untuk membaca pantulan pulse
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  digitalWrite(TRIG_PIN, LOW);

  // ── Inisialisasi Kamera ───────────────────────────────────
  Serial.println("[INFO] Inisialisasi kamera...");
  if (!initCamera()) {
    Serial.println("[ERROR] Gagal inisialisasi kamera! Restart...");
    // Blink merah 5x sebagai indikator error hardware
    ledBlink(RED_LED_PIN, 5, 200, 200);
    ESP.restart();
  }
  Serial.println("[INFO] Kamera OK");

  // ── Koneksi WiFi ──────────────────────────────────────────
  Serial.print("[INFO] Menghubungkan ke WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long wifiStart = millis();
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - wifiStart > WIFI_TIMEOUT_MS) {
      Serial.println("\n[ERROR] WiFi timeout! Restart...");
      ledBlink(RED_LED_PIN, 10, 100, 100);
      ESP.restart();
    }
    delay(500);
    Serial.print(".");
  }

  Serial.println("\n[INFO] WiFi berhasil terhubung!");
  Serial.print("[INFO] IP ESP32-CAM: ");
  Serial.println(WiFi.localIP());
  Serial.print("[INFO] Target server: http://");
  Serial.print(PI_SERVER_IP);
  Serial.print(":");
  Serial.println(PI_SERVER_PORT);

  // Blink hijau 2x = boot sukses
  ledBlink(GREEN_LED_PIN, 2, 200, 200);

  Serial.println("[INFO] Sistem siap. Menunggu objek...");
  Serial.println("==============================================");
}


// ============================================================
//  LOOP UTAMA
// ============================================================
void loop() {
  // ── Cek koneksi WiFi (auto-reconnect) ────────────────────
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WARN] WiFi terputus. Mencoba reconnect...");
    reconnectWiFi();
  }

  // ── Cek cooldown ──────────────────────────────────────────
  if (isCooldown && (millis() - lastCaptureTime >= COOLDOWN_MS)) {
    isCooldown = false;
    Serial.println("[INFO] Cooldown selesai. Siap mendeteksi.");
  }

  // ── Baca sensor ultrasonik ────────────────────────────────
  float distance = readUltrasonicDistance();

  if (distance > 0 && distance < DETECT_THRESHOLD_CM) {
    // Ada objek dalam jangkauan
    Serial.print("[INFO] Objek terdeteksi! Jarak: ");
    Serial.print(distance);
    Serial.println(" cm");

    if (!isCooldown) {
      // ── Capture image ──────────────────────────────────
      Serial.println("[INFO] Mengambil foto...");

      camera_fb_t* fb = esp_camera_fb_get();
      if (!fb) {
        Serial.println("[ERROR] Gagal capture frame!");
        handleError();
        delay(2000);
        return;
      }

      Serial.print("[INFO] Foto berhasil. Ukuran: ");
      Serial.print(fb->len);
      Serial.println(" bytes");

      // ── Kirim ke Raspberry Pi ──────────────────────────
      Serial.println("[INFO] Mengirim ke Raspberry Pi...");
      bool success = sendImageToRaspberryPi(fb);

      // Lepaskan frame buffer setelah selesai
      esp_camera_fb_return(fb);

      if (!success) {
        Serial.println("[ERROR] Gagal kirim ke Raspberry Pi");
        handleError();
      }

      // ── Aktifkan cooldown ──────────────────────────────
      // Walaupun ada error, tetap cooldown agar tidak loop terus
      lastCaptureTime = millis();
      isCooldown      = true;
      Serial.print("[INFO] Cooldown aktif (");
      Serial.print(COOLDOWN_MS / 1000);
      Serial.println(" detik)");

    } else {
      // Masih dalam cooldown, diam saja
      Serial.println("[INFO] Objek terdeteksi tapi masih cooldown...");
    }
  } else {
    // Tidak ada orang atau jarak terlalu jauh
    // Serial.print("[DEBUG] Jarak: "); Serial.print(distance); Serial.println(" cm");
  }

  // Interval baca sensor
  delay(SENSOR_READ_INTERVAL_MS);
}


// ============================================================
//  FUNGSI: INISIALISASI KAMERA
// ============================================================
/**
 * initCamera()
 * Inisialisasi OV2640 camera modul pada AI-Thinker ESP32-CAM.
 * Pin kamera di-hardcode sesuai skematik AI-Thinker.
 *
 * Mengembalikan true jika berhasil, false jika gagal.
 */
bool initCamera() {
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
  config.xclk_freq_hz = 20000000;       // 20MHz clock untuk kamera
  config.pixel_format = PIXFORMAT_JPEG; // Output JPEG langsung dari sensor

  // Kualitas dan resolusi kamera (dari config.h)
  config.frame_size   = CAPTURE_FRAMESIZE;
  config.jpeg_quality = CAPTURE_JPEG_QUALITY;

  // Buffer frame: 2 buffer jika ada PSRAM (memory lebih besar)
  if (psramFound()) {
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.fb_count = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] esp_camera_init gagal: 0x%x\n", err);
    return false;
  }

  // Optional: Sesuaikan pengaturan sensor setelah init
  sensor_t* s = esp_camera_sensor_get();
  if (s != NULL) {
    s->set_brightness(s, 0);   // -2 to 2
    s->set_contrast(s, 0);     // -2 to 2
    s->set_saturation(s, 0);   // -2 to 2
    s->set_whitebal(s, 1);     // 0 = disable, 1 = enable auto white balance
    s->set_exposure_ctrl(s, 1); // auto exposure
    s->set_gain_ctrl(s, 1);    // auto gain
    s->set_hmirror(s, 0);      // horizontal flip (set ke 1 jika kamera terbalik)
    s->set_vflip(s, 0);        // vertical flip
  }

  return true;
}


// ============================================================
//  FUNGSI: BACA JARAK ULTRASONIK
// ============================================================
/**
 * readUltrasonicDistance()
 * Membaca jarak dari sensor ultrasonik HC-SR04.
 * Sensor digunakan sebagai trigger agar kamera tidak capture terus-menerus.
 * Hanya jika ada orang di depan sensor, ESP32-CAM akan capture dan kirim.
 *
 * WIRING:
 *   TRIG_PIN (GPIO 14) → TRIG sensor (kirim pulse 10µs)
 *   ECHO_PIN (GPIO 13) → ECHO sensor (terima pulsa balik)
 *   VCC sensor         → 3.3V (sensor versi 3.3V)
 *   GND sensor         → GND
 *
 * Mengembalikan jarak dalam cm, atau -1 jika timeout.
 */
float readUltrasonicDistance() {
  // Pastikan TRIG LOW sebelum mulai
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Kirim pulse HIGH selama 10 mikro detik ke TRIG
  // Ini memicu sensor untuk mengirim pulsa ultrasonik
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Baca durasi pulsa ECHO (dalam mikro detik)
  // Timeout 30000µs = 30ms (setara jarak ~515cm, lebih dari jangkauan sensor)
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);

  if (duration == 0) {
    // Tidak ada echo = timeout = tidak ada objek dalam jangkauan
    return SENSOR_NO_ECHO_DISTANCE;
  }

  // Konversi durasi ke jarak:
  // Kecepatan suara ≈ 343 m/s = 0.0343 cm/µs
  // Jarak = (durasi * 0.0343) / 2   (dibagi 2 karena pulsa pergi-pulang)
  float distance = duration * 0.017f;  // cm
  return distance;
}


// ============================================================
//  FUNGSI: KIRIM IMAGE KE RASPBERRY PI
// ============================================================
/**
 * sendImageToRaspberryPi()
 * Mengirim frame JPEG ke Raspberry Pi via HTTP POST multipart/form-data.
 * Raspberry Pi yang melakukan face recognition, bukan ESP32-CAM.
 *
 * Flow:
 *   ESP32-CAM connect ke RPi TCP
 *   → Kirim HTTP POST header
 *   → Kirim multipart boundary + JPEG bytes
 *   → Tunggu response HTTP dari RPi
 *   → Parse response JSON: "ACCEPT" atau "DENY"
 *   → Panggil handleAccept() atau handleDeny()
 *
 * Mengembalikan true jika HTTP request berhasil (walaupun DENY).
 * Mengembalikan false jika koneksi atau network error.
 */
bool sendImageToRaspberryPi(camera_fb_t* fb) {
  WiFiClient client;

  // ── Koneksi TCP ke Raspberry Pi ──────────────────────────
  Serial.print("[INFO] Menghubungkan ke ");
  Serial.print(PI_SERVER_IP);
  Serial.print(":");
  Serial.println(PI_SERVER_PORT);

  if (!client.connect(PI_SERVER_IP, PI_SERVER_PORT)) {
    Serial.println("[ERROR] Gagal connect ke Raspberry Pi!");
    Serial.println("[ERROR] Pastikan RPi menyala dan server berjalan (python app/server.py)");
    client.stop();
    return false;
  }

  // ── Build HTTP multipart/form-data ───────────────────────
  // Format sesuai yang diharapkan Flask di Raspberry Pi:
  //   field name: "image"
  //   filename:   "capture.jpg"
  //   content-type: image/jpeg
  String boundary = "ESP32SmartDoor";
  String head = "--" + boundary + "\r\n"
                "Content-Disposition: form-data; name=\"image\"; filename=\"capture.jpg\"\r\n"
                "Content-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";

  // Total panjang konten
  int totalContentLen = head.length() + fb->len + tail.length();

  // ── Kirim HTTP request headers ────────────────────────────
  client.println("POST " + String(RECOGNIZE_ENDPOINT) + " HTTP/1.1");
  client.println("Host: " + String(PI_SERVER_IP));
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.println("Content-Length: " + String(totalContentLen));
  client.println("Connection: close");
  client.println();  // Baris kosong = akhir header

  // ── Kirim multipart body ──────────────────────────────────
  client.print(head);                 // Multipart boundary + header
  client.write(fb->buf, fb->len);     // JPEG bytes
  client.print(tail);                 // Penutup multipart

  Serial.println("[INFO] Image terkirim, menunggu response...");

  // ── Tunggu response dari Raspberry Pi ─────────────────────
  unsigned long waitStart = millis();
  while (client.available() == 0) {
    if (millis() - waitStart > HTTP_TIMEOUT_MS) {
      Serial.println("[ERROR] HTTP timeout! Raspberry Pi tidak respond.");
      client.stop();
      return false;
    }
    delay(10);
  }

  // ── Baca response HTTP ────────────────────────────────────
  String responseBody = "";
  bool headersDone   = false;
  String headerBuf   = "";

  while (client.available()) {
    String line = client.readStringUntil('\n');

    if (!headersDone) {
      headerBuf += line;
      // Header selesai ketika ada baris kosong (\r\n\r\n)
      if (line == "\r" || line.length() <= 1) {
        headersDone = true;
      }
    } else {
      // Ini adalah body response (JSON)
      responseBody += line;
    }
  }
  client.stop();

  responseBody.trim();
  Serial.print("[INFO] Response Raspberry Pi: ");
  Serial.println(responseBody);

  // ── Parse response JSON ───────────────────────────────────
  // Cari "status" di JSON. Tidak pakai library ArduinoJson agar
  // tidak butuh install library tambahan.
  // Format yang diharapkan: {"status": "ACCEPT", ...} atau {"status": "DENY", ...}
  if (responseBody.indexOf("\"ACCEPT\"") >= 0) {
    // ── WAJAH DIKENALI ─────────────────────────────────────
    // Cari nama dari response: {"name": "Raffi", ...}
    String name = "";
    int nameStart = responseBody.indexOf("\"name\": \"");
    if (nameStart >= 0) {
      nameStart += 9;  // skip past '"name": "'
      int nameEnd = responseBody.indexOf("\"", nameStart);
      if (nameEnd > nameStart) {
        name = responseBody.substring(nameStart, nameEnd);
      }
    }
    Serial.print("[INFO] ACCEPT — Selamat datang, ");
    Serial.println(name.length() > 0 ? name : "pengguna terdaftar");
    handleAccept();

  } else if (responseBody.indexOf("\"DENY\"") >= 0) {
    // ── WAJAH TIDAK DIKENALI ───────────────────────────────
    Serial.println("[INFO] DENY — Wajah tidak dikenali. Akses ditolak.");
    handleDeny();

  } else if (responseBody.indexOf("\"ERROR\"") >= 0) {
    // ── SERVER ERROR ───────────────────────────────────────
    Serial.println("[WARN] ERROR — Raspberry Pi melaporkan error.");
    handleError();

  } else {
    // ── Response tidak dikenali ────────────────────────────
    Serial.println("[WARN] Response tidak dikenali atau format tidak sesuai");
    Serial.println("[DEBUG] Raw response: " + responseBody);
    handleError();
  }

  return true;
}


// ============================================================
//  FUNGSI: HANDLE ACCEPT
// ============================================================
/**
 * handleAccept()
 * Dipanggil ketika Raspberry Pi mengembalikan status ACCEPT.
 * LED Hijau menyala selama ACCESS_RESULT_DURATION ms.
 */
void handleAccept() {
  allLedsOff();

  // LED Hijau ON → menandakan akses diterima
  digitalWrite(GREEN_LED_PIN, HIGH);
  Serial.println("[AKSI] LED Hijau ON — Pintu terbuka (simulasi)");

  delay(ACCESS_RESULT_DURATION);

  // LED Hijau OFF
  digitalWrite(GREEN_LED_PIN, LOW);
  Serial.println("[AKSI] LED Hijau OFF");
}


// ============================================================
//  FUNGSI: HANDLE DENY
// ============================================================
/**
 * handleDeny()
 * Dipanggil ketika Raspberry Pi mengembalikan status DENY.
 * LED Merah + Buzzer menyala selama ACCESS_RESULT_DURATION ms.
 */
void handleDeny() {
  allLedsOff();

  // LED Merah ON + Buzzer ON → menandakan akses ditolak
  digitalWrite(RED_LED_PIN, HIGH);
  digitalWrite(BUZZER_PIN,  HIGH);
  Serial.println("[AKSI] LED Merah + Buzzer ON — Akses ditolak");

  delay(ACCESS_RESULT_DURATION);

  // LED Merah OFF + Buzzer OFF
  digitalWrite(RED_LED_PIN, LOW);
  digitalWrite(BUZZER_PIN,  LOW);
  Serial.println("[AKSI] LED Merah + Buzzer OFF");
}


// ============================================================
//  FUNGSI: HANDLE ERROR
// ============================================================
/**
 * handleError()
 * Dipanggil saat terjadi error (koneksi gagal, server error, dll).
 * LED Merah blink 3x sebagai tanda error.
 */
void handleError() {
  allLedsOff();
  Serial.println("[AKSI] Error — LED Merah blink 3x");
  // Blink 3x dengan cepat
  ledBlink(RED_LED_PIN, 3, 150, 150);
}


// ============================================================
//  FUNGSI UTILITY: LED
// ============================================================

/**
 * allLedsOff()
 * Matikan semua LED dan buzzer.
 * Selalu dipanggil sebelum menyalakan LED baru.
 */
void allLedsOff() {
  digitalWrite(GREEN_LED_PIN, LOW);
  digitalWrite(RED_LED_PIN,   LOW);
  digitalWrite(BUZZER_PIN,    LOW);
}

/**
 * ledBlink()
 * Kedipkan LED sebanyak 'times' kali.
 *
 * pin    : GPIO pin LED
 * times  : jumlah kedipan
 * onMs   : durasi LED menyala (ms)
 * offMs  : durasi LED mati (ms)
 */
void ledBlink(int pin, int times, int onMs, int offMs) {
  for (int i = 0; i < times; i++) {
    digitalWrite(pin, HIGH);
    delay(onMs);
    digitalWrite(pin, LOW);
    if (i < times - 1) delay(offMs);
  }
}


// ============================================================
//  FUNGSI: RECONNECT WIFI
// ============================================================
/**
 * reconnectWiFi()
 * Coba hubungkan kembali ke WiFi jika koneksi terputus.
 * Blink LED merah perlahan selama proses reconnect.
 */
void reconnectWiFi() {
  allLedsOff();
  WiFi.disconnect();
  delay(1000);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long start = millis();
  int attempt = 0;
  while (WiFi.status() != WL_CONNECTED) {
    if (millis() - start > WIFI_TIMEOUT_MS) {
      Serial.println("[ERROR] Reconnect WiFi gagal! Restart...");
      ESP.restart();
    }
    // Blink LED merah perlahan = sedang reconnect
    digitalWrite(RED_LED_PIN, HIGH);
    delay(300);
    digitalWrite(RED_LED_PIN, LOW);
    delay(300);
    attempt++;
    if (attempt % 10 == 0) {
      Serial.println("[INFO] Mencoba reconnect WiFi...");
    }
  }

  Serial.println("[INFO] WiFi reconnect berhasil!");
  Serial.print("[INFO] IP: ");
  Serial.println(WiFi.localIP());
  allLedsOff();
}

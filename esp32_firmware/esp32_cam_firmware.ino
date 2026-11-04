#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// ============================================================================
// 1. KONFIGURASI WI-FI HOTSPOT & BACKEND LAPTOP
// ============================================================================
const char* WIFI_SSID     = "RP1";
const char* WIFI_PASSWORD = "raffi123";

// IP Laptop Anda (Sesuai ipconfig)
const char* SERVER_HOST   = "192.168.160.162";
const int   SERVER_PORT   = 8000;
const char* SERVER_PATH   = "/api/recognize";

// ============================================================================
// 2. PIN INDIKATOR LED & KAMERA OV2640 (AI-THINKER)
// ============================================================================
#define LED_FLASH_PIN     4   // Flash LED putih terang
#define LED_BUILTIN_PIN   33  // LED merah kecil bawaan (Active LOW)

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

httpd_handle_t stream_httpd = NULL;

#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

// ============================================================================
// 3. HANDLER STREAMING VIDEO MJPEG (UNTUK BROWSER)
// ============================================================================
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  char part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  Serial.println("\n[STREAM] Browser laptop terhubung ke Live Stream!");
  digitalWrite(LED_BUILTIN_PIN, LOW); // LED indikator menyala saat streaming

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[STREAM] Gagal ambil frame");
      res = ESP_FAIL;
      break;
    }

    size_t hlen = snprintf(part_buf, 64, _STREAM_PART, fb->len);
    res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, (const char *)fb->buf, fb->len);
    if (res == ESP_OK) res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));

    esp_camera_fb_return(fb);
    fb = NULL;

    if (res != ESP_OK) break;
  }

  digitalWrite(LED_BUILTIN_PIN, HIGH);
  Serial.println("[STREAM] Browser terputus dari stream.");
  return res;
}

// Halaman utama browser
static esp_err_t index_handler(httpd_req_t *req) {
  const char* html = 
    "<!DOCTYPE html><html><head><meta charset='utf-8'>"
    "<title>ESP32-CAM Live Stream</title>"
    "<style>"
    "body{font-family:sans-serif;background:#18181b;color:#fff;text-align:center;padding:20px;margin:0;}"
    "h1{color:#ffd23d;font-size:22px;margin-bottom:6px;}"
    "p{color:#a1a1aa;font-size:13px;margin-top:0;}"
    ".box{max-width:640px;margin:0 auto;border:2px solid #3f3f46;border-radius:12px;overflow:hidden;background:#000;}"
    "img{width:100%;height:auto;display:block;}"
    ".badge{display:inline-block;background:#00cd8f;color:#000;font-weight:bold;padding:5px 12px;border-radius:20px;font-size:12px;margin-top:14px;}"
    "</style></head><body>"
    "<h1>Live Video Streaming ESP32-CAM</h1>"
    "<p>Smart Door Lock - Smart Classroom PBL</p>"
    "<div class='box'><img src='/stream' alt='Live Video Stream'></div>"
    "<div><span class='badge'>STREAMING AKTIF (MJPEG)</span></div>"
    "</body></html>";

  httpd_resp_set_type(req, "text/html");
  return httpd_resp_send(req, html, strlen(html));
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;

  httpd_uri_t index_uri = { .uri = "/", .method = HTTP_GET, .handler = index_handler, .user_ctx = NULL };
  httpd_uri_t stream_uri = { .uri = "/stream", .method = HTTP_GET, .handler = stream_handler, .user_ctx = NULL };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    Serial.println("[SERVER] Web Server Streaming aktif di Port 80!");
  }
}

// ============================================================================
// 4. PENGIRIMAN FOTO KE BACKEND FASTAPI (TEST RECOGNIZE)
// ============================================================================
void sendFrameToBackend() {
  Serial.println("\n--------------------------------------------------");
  Serial.println("[AI TEST] Mengambil foto untuk dikirim ke Backend...");

  // Flash kedip
  digitalWrite(LED_FLASH_PIN, HIGH);
  delay(120);
  digitalWrite(LED_FLASH_PIN, LOW);

  camera_fb_t* fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[AI TEST] ERROR: Gagal mengambil foto kamera!");
    return;
  }

  Serial.printf("[AI TEST] Foto siap (%u bytes). Menghubungkan ke %s:%d ...\n", fb->len, SERVER_HOST, SERVER_PORT);

  WiFiClient client;
  if (!client.connect(SERVER_HOST, SERVER_PORT)) {
    Serial.println("[AI TEST] ERROR: Gagal konek ke laptop! Pastikan backend Python berjalan di port 8000.");
    esp_camera_fb_return(fb);
    return;
  }

  String boundary = "----ESP32CamBoundary7MA4YWxkTrZu0gW";
  String head = "--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"face.jpg\"\r\nContent-Type: image/jpeg\r\n\r\n";
  String tail = "\r\n--" + boundary + "--\r\n";
  uint32_t totalLen = head.length() + fb->len + tail.length();

  client.println("POST " + String(SERVER_PATH) + " HTTP/1.1");
  client.println("Host: " + String(SERVER_HOST) + ":" + String(SERVER_PORT));
  client.println("Content-Type: multipart/form-data; boundary=" + boundary);
  client.println("Content-Length: " + String(totalLen));
  client.println("Connection: close");
  client.println();

  client.print(head);

  uint8_t* fbBuf = fb->buf;
  size_t fbLen = fb->len;
  for (size_t n = 0; n < fbLen; n += 1024) {
    size_t chunk = (fbLen - n < 1024) ? (fbLen - n) : 1024;
    client.write(fbBuf + n, chunk);
  }
  client.print(tail);
  esp_camera_fb_return(fb);

  Serial.println("[AI TEST] Foto terkirim! Menunggu keputusan server AI...");

  unsigned long timeout = millis();
  while (client.connected() && !client.available()) {
    if (millis() - timeout > 6000) {
      Serial.println("[AI TEST] Timeout: Backend tidak membalas.");
      client.stop();
      return;
    }
    delay(10);
  }

  String responseBody = "";
  bool isBody = false;
  while (client.available()) {
    String line = client.readStringUntil('\n');
    if (line == "\r") {
      isBody = true;
      continue;
    }
    if (isBody) responseBody += line;
  }
  client.stop();

  Serial.println("\n[RESPON BACKEND FASTAPI]:");
  Serial.println(responseBody);

  if (responseBody.indexOf("\"decision\":\"ACCEPT\"") >= 0 || responseBody.indexOf("\"status\":\"success\"") >= 0) {
    Serial.println("\n>>> HASIL: [AKSES DIIZINKAN (WAJAH TERVERIFIKASI)] <<<");
    digitalWrite(LED_FLASH_PIN, HIGH);
    delay(2000);
    digitalWrite(LED_FLASH_PIN, LOW);
  } else if (responseBody.indexOf("\"status\":\"tailgating\"") >= 0) {
    Serial.println("\n>>> HASIL: [AKSES DITOLAK: TAILGATING ALERT (>1 ORANG)] <<<");
  } else if (responseBody.indexOf("\"status\":\"no_face\"") >= 0) {
    Serial.println("\n>>> HASIL: [TIDAK ADA WAJAH TERDETEKSI] <<<");
  } else {
    Serial.println("\n>>> HASIL: [AKSES DITOLAK (WAJAH TIDAK TERDAFTAR)] <<<");
  }
  Serial.println("--------------------------------------------------\n");
}

// ============================================================================
// 5. INISIALISASI KAMERA OV2640
// ============================================================================
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
  config.pin_sscb_sda = SIOD_GPIO_NUM;
  config.pin_sscb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  if (psramFound()) {
    config.frame_size   = FRAMESIZE_VGA; // 640x480
    config.jpeg_quality = 12;
    config.fb_count     = 2;
  } else {
    config.frame_size   = FRAMESIZE_QVGA; // 320x240
    config.jpeg_quality = 14;
    config.fb_count     = 1;
  }

  esp_err_t err = esp_camera_init(&config);
  return (err == ESP_OK);
}

// ============================================================================
// 6. SETUP & LOOP UTAMA
// ============================================================================
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n==================================================");
  Serial.println("  ESP32-CAM SMART DOOR LOCK (TEST STREAMING)      ");
  Serial.println("==================================================");

  pinMode(LED_FLASH_PIN, OUTPUT);
  pinMode(LED_BUILTIN_PIN, OUTPUT);
  digitalWrite(LED_FLASH_PIN, LOW);
  digitalWrite(LED_BUILTIN_PIN, HIGH);

  Serial.print("[BOOT] Inisialisasi Kamera OV2640... ");
  if (initCamera()) {
    Serial.println("SUKSES!");
  } else {
    Serial.println("GAGAL! Periksa kabel pita kamera.");
    while (true) {
      digitalWrite(LED_BUILTIN_PIN, !digitalRead(LED_BUILTIN_PIN));
      delay(300);
    }
  }

  Serial.printf("[WIFI] Menghubungkan ke Wi-Fi: '%s' ...\n", WIFI_SSID);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Terhubung!");
    Serial.print("[WIFI] IP Address ESP32-CAM: ");
    Serial.println(WiFi.localIP());

    startCameraServer();

    Serial.println("\n==================================================");
    Serial.println("  PANDUAN PENGUJIAN:                              ");
    Serial.printf ("  1. Buka browser di laptop: http://%s/\n", WiFi.localIP().toString().c_str());
    Serial.println("     -> Anda dapat melihat Live Video Stream kamera!");
    Serial.println("  2. Di Serial Monitor, ketik 'c' lalu tekan ENTER");
    Serial.println("     -> ESP32 mengambil foto dan mengirim ke Backend AI!");
    Serial.println("==================================================\n");

    digitalWrite(LED_FLASH_PIN, HIGH);
    delay(200);
    digitalWrite(LED_FLASH_PIN, LOW);
  } else {
    Serial.println("\n[WIFI] Gagal terhubung ke Wi-Fi! Periksa SSID & Password Hotspot.");
  }
}

void loop() {
  // Cek apakah ada ketikan 'c' atau tombol Enter di Serial Monitor
  if (Serial.available()) {
    char c = Serial.read();
    if (c == 'c' || c == 'C' || c == '\n' || c == '\r') {
      sendFrameToBackend();
    }
  }
  delay(20);
}

/**
 * esp32_cam_stream_test.ino
 * =========================
 * Firmware Khusus Uji Coba Kamera ESP32-CAM (MJPEG Video Streaming Server).
 *
 * FITUR:
 * - Menghubungkan ESP32-CAM ke Hotspot WiFi ("IQBAL" / "nextnextnext").
 * - Menampilkan IP Address di Serial Monitor Arduino (115200 baud).
 * - Menjalankan MJPEG Video Streamer berkecepatan tinggi & lancar (low latency).
 * - Menyediakan Header CORS (Access-Control-Allow-Origin: *) agar dapat
 *   ditampilkan langsung di Web Dashboard (Next.js) & diambil gambarnya (capture).
 *
 * ENDPOINT:
 * - http://<IP_ESP32>/stream   -> Live Video Stream MJPEG
 * - http://<IP_ESP32>/capture  -> Ambil 1 foto snapshot JPEG
 *
 * CARA UPLOAD KE ESP32-CAM:
 * 1. Hubungkan pin GPIO 0 ke GND sebelum menyalakan ESP32 (Bootloader Mode).
 * 2. Di Arduino IDE:
 *    - Board: "AI Thinker ESP32-CAM"
 *    - CPU Frequency: "240MHz (WiFi/BT)"
 *    - Flash Frequency: "80MHz"
 *    - Flash Mode: "QIO"
 *    - Partition Scheme: "Huge APP (3MB No OTA/1MB SPIFFS)"
 * 3. Klik Upload.
 * 4. Lepaskan jumper GPIO 0 dari GND, lalu tekan tombol RESET di ESP32-CAM.
 * 5. Buka Serial Monitor pada baud rate 115200 untuk melihat IP Address-nya!
 */

#include "esp_camera.h"
#include <WiFi.h>
#include "esp_http_server.h"

// ============================================================
//  1. KONFIGURASI WIFI HOTSPOT
// ============================================================
const char* ssid     = "IQBAL";
const char* password = "nextnextnext";

// ============================================================
//  2. PIN KAMERA — AI-THINKER ESP32-CAM
// ============================================================
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

// Flash LED pin
#define FLASH_LED_PIN      4

// ============================================================
//  3. PART STREAMING CONSTANTS
// ============================================================
#define PART_BOUNDARY "123456789000000000000987654321"
static const char* _STREAM_CONTENT_TYPE = "multipart/x-mixed-replace;boundary=" PART_BOUNDARY;
static const char* _STREAM_BOUNDARY = "\r\n--" PART_BOUNDARY "\r\n";
static const char* _STREAM_PART = "Content-Type: image/jpeg\r\nContent-Length: %u\r\n\r\n";

httpd_handle_t stream_httpd = NULL;

// Handler: Live Stream MJPEG
static esp_err_t stream_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;
  size_t _jpg_buf_len = 0;
  uint8_t * _jpg_buf = NULL;
  char * part_buf[64];

  res = httpd_resp_set_type(req, _STREAM_CONTENT_TYPE);
  if (res != ESP_OK) return res;

  // Header CORS agar bisa diakses oleh Browser Next.js tanpa blokir
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  while (true) {
    fb = esp_camera_fb_get();
    if (!fb) {
      Serial.println("[ERROR] Gagal mengambil frame kamera");
      res = ESP_FAIL;
    } else {
      _jpg_buf_len = fb->len;
      _jpg_buf = fb->buf;
    }

    if (res == ESP_OK) {
      size_t hlen = snprintf((char *)part_buf, 64, _STREAM_PART, _jpg_buf_len);
      res = httpd_resp_send_chunk(req, (const char *)part_buf, hlen);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, (const char *)_jpg_buf, _jpg_buf_len);
    }
    if (res == ESP_OK) {
      res = httpd_resp_send_chunk(req, _STREAM_BOUNDARY, strlen(_STREAM_BOUNDARY));
    }
    if (fb) {
      esp_camera_fb_return(fb);
      fb = NULL;
      _jpg_buf = NULL;
    } else if (res != ESP_OK) {
      break;
    }
  }
  return res;
}

// Handler: Single Snapshot Capture
static esp_err_t capture_handler(httpd_req_t *req) {
  camera_fb_t * fb = NULL;
  esp_err_t res = ESP_OK;

  fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("[ERROR] Gagal capture foto");
    httpd_resp_send_500(req);
    return ESP_FAIL;
  }

  httpd_resp_set_type(req, "image/jpeg");
  httpd_resp_set_hdr(req, "Content-Disposition", "inline; filename=capture.jpg");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");

  res = httpd_resp_send(req, (const char *)fb->buf, fb->len);
  esp_camera_fb_return(fb);
  return res;
}

// Handler: Status Home
static esp_err_t index_handler(httpd_req_t *req) {
  const char* html = 
    "<!DOCTYPE html><html><head><title>ESP32-CAM Stream</title>"
    "<meta name='viewport' content='width=device-width, initial-scale=1'>"
    "<style>body{font-family:sans-serif;text-align:center;background:#121212;color:#fff;padding:20px;}"
    "img{max-width:100%;height:auto;border-radius:8px;border:2px solid #0099ff;margin-top:15px;}</style></head>"
    "<body><h2>ESP32-CAM Live Video Stream</h2>"
    "<p>Stream Aktif: <code>/stream</code> | Snapshot: <code>/capture</code></p>"
    "<img src='/stream' alt='Live Video Stream'/>"
    "</body></html>";

  httpd_resp_set_type(req, "text/html");
  httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
  return httpd_resp_send(req, html, strlen(html));
}

void startCameraServer() {
  httpd_config_t config = HTTPD_DEFAULT_CONFIG();
  config.server_port = 80;
  config.ctrl_port = 32768;

  httpd_uri_t index_uri = {
    .uri       = "/",
    .method    = HTTP_GET,
    .handler   = index_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t stream_uri = {
    .uri       = "/stream",
    .method    = HTTP_GET,
    .handler   = stream_handler,
    .user_ctx  = NULL
  };

  httpd_uri_t capture_uri = {
    .uri       = "/capture",
    .method    = HTTP_GET,
    .handler   = capture_handler,
    .user_ctx  = NULL
  };

  if (httpd_start(&stream_httpd, &config) == ESP_OK) {
    httpd_register_uri_handler(stream_httpd, &index_uri);
    httpd_register_uri_handler(stream_httpd, &stream_uri);
    httpd_register_uri_handler(stream_httpd, &capture_uri);
    Serial.println("[INFO] HTTP Server Kamera berhasil dimulai di port 80!");
  }
}

void setup() {
  Serial.begin(115200);
  Serial.setDebugOutput(false);
  Serial.println("\n");
  Serial.println("==================================================");
  Serial.println("   ESP32-CAM Live Streaming Server (Testing)");
  Serial.println("==================================================");

  // Konfigurasi Kamera
  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer = LEDC_TIMER_0;
  config.pin_d0 = Y2_GPIO_NUM;
  config.pin_d1 = Y3_GPIO_NUM;
  config.pin_d2 = Y4_GPIO_NUM;
  config.pin_d3 = Y5_GPIO_NUM;
  config.pin_d4 = Y6_GPIO_NUM;
  config.pin_d5 = Y7_GPIO_NUM;
  config.pin_d6 = Y8_GPIO_NUM;
  config.pin_d7 = Y9_GPIO_NUM;
  config.pin_xclk = XCLK_GPIO_NUM;
  config.pin_pclk = PCLK_GPIO_NUM;
  config.pin_vsync = VSYNC_GPIO_NUM;
  config.pin_href = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn = PWDN_GPIO_NUM;
  config.pin_reset = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Resolusi optimal untuk streaming lancar (tidak lag / patah-patah)
  if (psramFound()) {
    config.frame_size = FRAMESIZE_VGA;  // 640x480
    config.jpeg_quality = 12;           // 10-63 (semakin kecil semakin bagus)
    config.fb_count = 2;
    config.grab_mode = CAMERA_GRAB_LATEST;
  } else {
    config.frame_size = FRAMESIZE_CIF;  // 400x296
    config.jpeg_quality = 14;
    config.fb_count = 1;
  }

  // Inisialisasi Kamera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("[ERROR] Inisialisasi kamera gagal: 0x%x\n", err);
    return;
  }
  Serial.println("[INFO] Kamera OV2640 berhasil diinisialisasi.");

  // Koneksi WiFi ke Hotspot
  Serial.printf("[INFO] Menghubungkan ke Hotspot WiFi '%s'...\n", ssid);
  WiFi.begin(ssid, password);
  WiFi.setSleep(false); // Matikan WiFi sleep agar stream stabil tanpa delay

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[SUCCESS] Berhasil terhubung ke WiFi!");
    Serial.print(">>> IP Address ESP32-CAM: ");
    Serial.println(WiFi.localIP());
    Serial.println("==================================================");
    Serial.printf("Buka di Browser / Masukkan ke Web App:\n");
    Serial.printf("Live Stream Video : http://%s/stream\n", WiFi.localIP().toString().c_str());
    Serial.printf("Snapshot Foto     : http://%s/capture\n", WiFi.localIP().toString().c_str());
    Serial.println("==================================================");

    // Mulai Server Streaming
    startCameraServer();
  } else {
    Serial.println("\n[ERROR] Gagal terhubung ke WiFi Hotspot. Periksa SSID dan Password!");
  }
}

void loop() {
  // Semua proses streaming ditangani oleh background HTTP daemon FreeRTOS
  delay(10000);
}

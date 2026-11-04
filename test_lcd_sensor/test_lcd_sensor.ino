/*
 * ============================================================================
 * SKETCH PENGUJIAN KHUSUS: LCD I2C 16x2 & SENSOR ULTRASONIK HC-SR04
 * (TANPA WI-FI / TANPA INTERNET / TANPA KAMERA - RINGAN & CEPAT DI-UPLOAD!)
 * ============================================================================
 *
 * PETA PIN DI ESP32-CAM:
 * ----------------------------------------------------------------------------
 * 1. DAYA (5V & GND):
 *    - 5V ESP32-CAM  -> Jalur Positif (+) Breadboard (Untuk VCC LCD & VCC Sensor)
 *    - GND ESP32-CAM -> Jalur Negatif (-) Breadboard (Untuk GND LCD & GND Sensor)
 *
 * 2. LAYAR LCD I2C 16x2:
 *    - VCC -> 5V Breadboard
 *    - GND -> GND Breadboard
 *    - SDA -> Pin IO14 ESP32-CAM
 *    - SCL -> Pin IO15 ESP32-CAM
 *
 * 3. SENSOR ULTRASONIK HC-SR04:
 *    - VCC  -> 5V Breadboard
 *    - GND  -> GND Breadboard
 *    - TRIG -> Pin IO13 ESP32-CAM
 *    - ECHO -> Pin IO12 ESP32-CAM (Atau digabung satu kabel ke IO13)
 *
 * CARA KERJA SKETCH INI:
 * - Mengukur jarak objek di depan sensor setiap 200 ms.
 * - Baris 1 LCD: Menampilkan jarak real-time (contoh: "JARAK: 4.2 cm").
 * - Baris 2 LCD:
 *   * Jika jarak <= 5.0 cm -> Menampilkan: "** OBJEK <=5CM **"
 *   * Jika jarak >  5.0 cm -> Menampilkan: "STATUS: > 5 CM  "
 * ============================================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>

// ----------------------------------------------------------------------------
// KONFIGURASI PIN
// ----------------------------------------------------------------------------
#define I2C_SDA_PIN       14 // Pin SDA LCD I2C
#define I2C_SCL_PIN       15 // Pin SCL LCD I2C

#define TRIG_PIN          13 // Pin TRIG Sensor Ultrasonik
#define ECHO_PIN          12 // Pin ECHO Sensor Ultrasonik (bisa digabung ke IO13)

const float TARGET_DISTANCE_CM = 5.0; // Batas deteksi 5 cm

LiquidCrystal_I2C* activeLcd = nullptr;
bool lcdReady = false;
uint8_t lcdAddress = 0x27;

// ----------------------------------------------------------------------------
// HELPER TAMPILAN LCD
// ----------------------------------------------------------------------------
String pad16(const String& text) {
  String res = text;
  if (res.length() > 16) {
    return res.substring(0, 16);
  }
  while (res.length() < 16) {
    res += " ";
  }
  return res;
}

void printLCD(const String& line1, const String& line2) {
  if (!lcdReady || activeLcd == nullptr) return;
  activeLcd->setCursor(0, 0);
  activeLcd->print(pad16(line1));
  activeLcd->setCursor(0, 1);
  activeLcd->print(pad16(line2));
}

// ----------------------------------------------------------------------------
// AUTO-SCANNER ALAMAT LCD I2C (0x27 atau 0x3F)
// ----------------------------------------------------------------------------
bool initLCD() {
  Wire.end();
  pinMode(I2C_SDA_PIN, INPUT_PULLUP);
  pinMode(I2C_SCL_PIN, INPUT_PULLUP);
  Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 100000);

  uint8_t testAddrs[] = {0x27, 0x3F};
  for (uint8_t addr : testAddrs) {
    Wire.beginTransmission(addr);
    if (Wire.endTransmission() == 0) {
      lcdAddress = addr;
      lcdReady = true;

      if (activeLcd != nullptr) delete activeLcd;
      activeLcd = new LiquidCrystal_I2C(lcdAddress, 16, 2);

      activeLcd->init();
      // Panggil Wire.begin lagi agar tidak tereset ke default oleh library AVR
      Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN, 100000);
      activeLcd->begin(16, 2);
      activeLcd->backlight();

      Serial.printf("[LCD OK] LCD I2C ditemukan di alamat 0x%02X!\n", lcdAddress);
      printLCD("TEST SENSOR...", "MEMULAI SISTEM");
      delay(1200);
      return true;
    }
  }

  Serial.println("[LCD WARNING] LCD I2C belum terdeteksi. Cek SDA=IO14, SCL=IO15, 5V, dan GND.");
  return false;
}

// ----------------------------------------------------------------------------
// BACA JARAK SENSOR ULTRASONIK HC-SR04
// ----------------------------------------------------------------------------
float readDistanceCm() {
  // 1. Coba baca lewat ECHO_PIN standar (IO12)
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(4);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  pinMode(ECHO_PIN, INPUT);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000); // Timeout 30ms (~5 meter)

  // 2. Jika 0 (misal TRIG & ECHO digabung di IO13), baca balik dari TRIG_PIN
  if (duration == 0 && ECHO_PIN != TRIG_PIN) {
    pinMode(TRIG_PIN, OUTPUT);
    digitalWrite(TRIG_PIN, LOW);
    delayMicroseconds(4);
    digitalWrite(TRIG_PIN, HIGH);
    delayMicroseconds(10);
    digitalWrite(TRIG_PIN, LOW);
    pinMode(TRIG_PIN, INPUT);
    duration = pulseIn(TRIG_PIN, HIGH, 30000);
    pinMode(TRIG_PIN, OUTPUT);
    digitalWrite(TRIG_PIN, LOW);
  }

  if (duration <= 0) {
    return 999.0; // Tidak ada objek terdeteksi
  }

  float dist = (duration * 0.0343f) / 2.0f;
  // Filter noise listrik glitch sangat kecil
  if (dist < 0.4f) {
    return 999.0;
  }
  return dist;
}

// ----------------------------------------------------------------------------
// SETUP
// ----------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("\n==================================================");
  Serial.println("  TEST HARDWARE: LCD I2C 16x2 + SENSOR HC-SR04   ");
  Serial.println("==================================================");

  // Inisialisasi LCD
  initLCD();

  // Inisialisasi Pin Sensor Ultrasonik
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  if (ECHO_PIN != TRIG_PIN) {
    pinMode(ECHO_PIN, INPUT);
  }

  Serial.println("Sistem siap! Dekatkan tangan ke sensor untuk menguji jarak.");
}

// ----------------------------------------------------------------------------
// LOOP UTAMA (TEST LIVE)
// ----------------------------------------------------------------------------
void loop() {
  float distance = readDistanceCm();

  String baris1;
  String baris2;

  if (distance >= 999.0) {
    baris1 = "JARAK: --.- cm";
    baris2 = "TIDAK ADA OBJEK ";
    Serial.println("[SENSOR] Tidak ada pantulan objek (Jarak > 4m atau kabel belum pas)");
  } else {
    baris1 = "JARAK: " + String(distance, 1) + " cm";

    // Pengecekan kondisi 5 cm
    if (distance <= TARGET_DISTANCE_CM) {
      baris2 = "** OBJEK <=5CM **";
      Serial.printf("[DETEKSI <= 5CM!] Jarak: %.1f cm -> OBJEK TERDETEKSI!\n", distance);
    } else {
      baris2 = "STATUS: > 5 CM  ";
      Serial.printf("[SENSOR] Jarak: %.1f cm (Di luar target 5 cm)\n", distance);
    }
  }

  // Update Tampilan LCD 16x2
  printLCD(baris1, baris2);

  delay(250); // Pembacaan diperbarui tiap 0.25 detik
}


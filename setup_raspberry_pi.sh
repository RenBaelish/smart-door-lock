#!/usr/bin/env bash
# ==============================================================================
# Script Setup Otomatis Smart Classroom Face Recognition & Access Control
# Target OS: Raspberry Pi OS (Debian Bookworm/Bullseye 64-bit / 32-bit)
# ==============================================================================

set -e

# Warna output terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}====================================================================${NC}"
echo -e "${GREEN}  SETUP SMART CLASSROOM FACE RECOGNITION SERVER - RASPBERRY PI     ${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Script ini akan mengonfigurasi Raspberry Pi Anda dari nol (fresh install):"
echo -e " 1. Optimasi Repositori Paket APT Sistem"
echo -e " 2. Optimasi Swap Memory (Cegah Crash Out-of-Memory)"
echo -e " 3. Install Dependensi C/C++ untuk dlib & face_recognition"
echo -e " 4. Install & Jalankan Docker PostgreSQL pgvector"
echo -e " 5. Install Node.js LTS (v20.x)"
echo -e " 6. Setup Virtual Environment Python Backend & dlib"
echo -e " 7. Setup & Build Frontend Next.js Dashboard"
echo -e " 8. Konfigurasi Nginx Reverse Proxy (Port 80)"
echo -e " 9. Konfigurasi Systemd Auto-Start on Boot"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Tips: Anda bisa menjalankan langkah tertentu, misal: ./setup_raspberry_pi.sh 7"
echo ""

# Pastikan dijalankan bukan sebagai root langsung, tapi memiliki sudo
if [ "$EUID" -eq 0 ]; then
  echo -e "${YELLOW}Perhatian: Jalankan script ini sebagai user biasa (misal: kali atau pi) dengan hak sudo, bukan root!${NC}"
  echo "Contoh: bash setup_raspberry_pi.sh"
  exit 1
fi

PROJECT_DIR=$(pwd)
CURRENT_USER=$(whoami)
START_STEP=${1:-1}

if [ "$START_STEP" -gt 1 ]; then
  echo -e "${YELLOW}>> Melanjutkan instalasi mulai dari Langkah [$START_STEP/9]...${NC}\n"
fi

if [ "$START_STEP" -le 1 ]; then
  echo -e "${GREEN}[1/9] Memperbarui Repositori Paket APT Sistem...${NC}"
  sudo apt update && sudo apt upgrade -y
fi

if [ "$START_STEP" -le 2 ]; then
  echo -e "${GREEN}[2/9] Menyesuaikan Swap Memory ke 2048 MB (Cegah OOM saat build)...${NC}"
  if [ -f /etc/dphys-swapfile ]; then
    sudo dphys-swapfile swapoff || true
    sudo sed -i 's/^CONF_SWAPSIZE=.*/CONF_SWAPSIZE=2048/' /etc/dphys-swapfile
    sudo dphys-swapfile setup
    sudo dphys-swapfile swapon
    echo -e "${GREEN}Swap berhasil ditingkatkan menjadi 2048 MB.${NC}"
  else
    echo -e "${YELLOW}/etc/dphys-swapfile tidak ditemukan, melewati konfigurasi swap.${NC}"
  fi
fi

if [ "$START_STEP" -le 3 ]; then
  echo -e "${GREEN}[3/9] Menginstall Dependensi Sistem & Library C/C++ untuk dlib...${NC}"
  sudo apt install -y \
    build-essential \
    cmake \
    pkg-config \
    git \
    curl \
    wget \
    libopenblas-dev \
    liblapack-dev \
    libjpeg-dev \
    libpng-dev \
    libtiff-dev \
    libavcodec-dev \
    libavformat-dev \
    libswscale-dev \
    libv4l-dev \
    libxvidcore-dev \
    libx264-dev \
    gfortran \
    python3-dev \
    python3-pip \
    python3-venv \
    nginx
fi

if [ "$START_STEP" -le 4 ]; then
  echo -e "${GREEN}[4/9] Memeriksa & Menginstall Docker (PostgreSQL pgvector)...${NC}"
  if ! command -v docker &> /dev/null; then
    echo "Menginstall Docker Engine..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker "$CURRENT_USER"
    rm -f get-docker.sh
  else
    echo "Docker sudah terinstall: $(docker --version)"
  fi
  sudo systemctl enable docker
  sudo systemctl start docker

  echo "Menjalankan database PostgreSQL pgvector via Docker Compose..."
  cd "$PROJECT_DIR"
  sudo docker compose up -d db

  echo "Menunggu kontainer database siap (healthcheck)..."
  sleep 8
fi

if [ "$START_STEP" -le 5 ]; then
  echo -e "${GREEN}[5/9] Menginstall Node.js v20 LTS...${NC}"
  if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
  else
    echo "Node.js sudah terinstall: $(node -v)"
  fi
  echo "NPM Version: $(npm -v)"
fi

if [ "$START_STEP" -le 6 ]; then
  echo -e "${GREEN}[6/9] Menyiapkan Virtual Environment Python Backend...${NC}"
  cd "$PROJECT_DIR/backend"

  # Buat konfigurasi .env backend terhubung ke PostgreSQL Docker
  cat <<EOF > .env
DATABASE_URL=postgresql+psycopg2://facelock:facelock@localhost:5433/facelock
MATCH_THRESHOLD=0.48
DUPLICATE_THRESHOLD=0.40
MAX_IMAGE_WIDTH=800
DETECTION_MODEL=hog
UPSAMPLE_TIMES=0
REGISTER_JITTERS=3
RECOGNIZE_JITTERS=1
CORS_ORIGINS=*
EOF

  if [ ! -d "venv" ]; then
    python3 -m venv venv
  fi

  source venv/bin/activate
  pip install --upgrade pip setuptools wheel

  echo -e "${YELLOW}Menginstall dependensi Python (FastAPI, SQLAlchemy, psycopg2, pgvector, NumPy, Pillow)...${NC}"
  pip install -r requirements.txt

  echo -e "${YELLOW}Menginstall dlib & face_recognition (proses kompilasi di Raspberry Pi)...${NC}"
  pip install dlib
  pip install face_recognition

  mkdir -p captures

  # Inisialisasi Database (Load relasi tabel, pgvector, dan seed jadwal)
  python -c "import database; database.init_db(); print('Database PostgreSQL & pgvector berhasil terhubung dan siap!')"
  deactivate
  cd "$PROJECT_DIR"
fi

if [ "$START_STEP" -le 7 ]; then
  echo -e "${GREEN}[7/9] Menyiapkan Frontend Next.js...${NC}"
  cd "$PROJECT_DIR/frontend"

  # Konfigurasi .env.local untuk environment Raspberry Pi (kosongkan agar menggunakan relative path via Nginx)
  cat <<EOF > .env.local
NEXT_PUBLIC_API_URL=
EOF

  echo "Menginstall dependensi NPM Frontend..."
  npm install

  echo "Membangun (build) bundle frontend Next.js..."
  export NODE_OPTIONS="--max-old-space-size=2048"
  npm run build
  cd "$PROJECT_DIR"
fi

if [ "$START_STEP" -le 8 ]; then
  echo -e "${GREEN}[8/9] Mengonfigurasi Nginx Web Server & Reverse Proxy...${NC}"
  NGINX_CONF="/etc/nginx/sites-available/smartclassroom"

  sudo bash -c "cat << 'EOF' > $NGINX_CONF
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 20M;

    # 1. Routing API ke FastAPI Backend (Uvicorn)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    # Endpoint recognise langsung untuk ESP32-CAM
    location /recognize {
        proxy_pass http://127.0.0.1:8000/recognize;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    # 2. Routing Web Dashboard Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF"

  # Hapus default nginx site jika ada dan aktifkan smartclassroom
  sudo rm -f /etc/nginx/sites-enabled/default
  sudo ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/smartclassroom
  sudo nginx -t
  sudo systemctl restart nginx
  sudo systemctl enable nginx
fi

if [ "$START_STEP" -le 9 ]; then
  echo -e "${GREEN}[9/9] Membuat Systemd Service untuk Backend & Frontend (Auto-Start on Boot)...${NC}"

  # Service Backend FastAPI
  BACKEND_SERVICE="/etc/systemd/system/smartclassroom-backend.service"
  sudo bash -c "cat << EOF > $BACKEND_SERVICE
[Unit]
Description=Smart Classroom FastAPI Backend Service
# Wajib tunggu jaringan/Wi-Fi benar-benar online DAN Docker database sudah aktif
After=network-online.target docker.service
Wants=network-online.target docker.service

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR/backend
Environment=PATH=$PROJECT_DIR/backend/venv/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin
# Jeda 25 detik saat boot agar Raspberry Pi tenang, SSH siap, dan DB PostgreSQL warm-up
ExecStartPre=/bin/sleep 25
ExecStart=$PROJECT_DIR/backend/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 --workers 2
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

  # Service Frontend Next.js
  FRONTEND_SERVICE="/etc/systemd/system/smartclassroom-frontend.service"
  sudo bash -c "cat << EOF > $FRONTEND_SERVICE
[Unit]
Description=Smart Classroom Next.js Frontend Service
# Tunggu jaringan online dan backend sudah mulai jalan
After=network-online.target smartclassroom-backend.service
Wants=network-online.target

[Service]
Type=simple
User=$CURRENT_USER
WorkingDirectory=$PROJECT_DIR/frontend
Environment=PATH=/usr/bin:/usr/local/bin:$PROJECT_DIR/frontend/node_modules/.bin
# Jeda 30 detik agar backend dan database siap terlebih dahulu
ExecStartPre=/bin/sleep 30
ExecStart=/usr/bin/npm run start -- -p 3000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF"

  # Reload systemd and enable services
  sudo systemctl daemon-reload
  sudo systemctl enable smartclassroom-backend
  sudo systemctl restart smartclassroom-backend

  sudo systemctl enable smartclassroom-frontend
  sudo systemctl restart smartclassroom-frontend
fi

IP_ADDR=$(hostname -I | awk '{print $1}')

echo ""
echo -e "${BLUE}====================================================================${NC}"
echo -e "${GREEN}           SELAMAT! SETUP RASPBERRY PI SELESAI DENGAN SUKSES!        ${NC}"
echo -e "${BLUE}====================================================================${NC}"
echo -e "Web Dashboard Smart Classroom dapat diakses di browser:"
echo -e "  -> ${GREEN}http://$IP_ADDR/${NC} atau ${GREEN}http://localhost/${NC}"
echo ""
echo -e "Alamat Endpoint untuk ESP32-CAM (di kode Arduino/C++):"
echo -e "  -> URL Pengenalan Wajah : ${YELLOW}http://$IP_ADDR/recognize?room=GSG212${NC}"
echo -e "  -> URL Status Kesehatan : ${YELLOW}http://$IP_ADDR/api/health${NC}"
echo ""
echo -e "Perintah Cek Status Layanan:"
echo -e "  Backend  : ${YELLOW}sudo systemctl status smartclassroom-backend${NC}"
echo -e "  Frontend : ${YELLOW}sudo systemctl status smartclassroom-frontend${NC}"
echo -e "  Nginx    : ${YELLOW}sudo systemctl status nginx${NC}"
echo -e "${BLUE}====================================================================${NC}"

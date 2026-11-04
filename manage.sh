#!/usr/bin/env bash
# ==============================================================================
# Script Manajemen Layanan Smart Classroom di Raspberry Pi
# Penggunaan:
#   ./manage.sh status
#   ./manage.sh restart
#   ./manage.sh logs-backend
#   ./manage.sh logs-frontend
# ==============================================================================

ACTION=$1

case "$ACTION" in
  status)
    echo "=== Status Docker Database (PostgreSQL pgvector) ==="
    sudo docker compose ps
    echo ""
    echo "=== Status Nginx ==="
    sudo systemctl status nginx --no-pager
    echo ""
    echo "=== Status Backend (FastAPI - 4 Workers) ==="
    sudo systemctl status smartclassroom-backend --no-pager
    echo ""
    echo "=== Status Frontend (Next.js) ==="
    sudo systemctl status smartclassroom-frontend --no-pager
    ;;
  restart)
    echo "Merestart semua layanan..."
    sudo docker compose up -d db
    sudo systemctl restart smartclassroom-backend
    sudo systemctl restart smartclassroom-frontend
    sudo systemctl restart nginx
    echo "Selesai!"
    ;;
  stop)
    echo "Menghentikan layanan..."
    sudo systemctl stop smartclassroom-backend
    sudo systemctl stop smartclassroom-frontend
    sudo docker compose stop
    echo "Layanan dihentikan."
    ;;
  start)
    echo "Menjalankan layanan..."
    sudo docker compose up -d db
    sudo systemctl start smartclassroom-backend
    sudo systemctl start smartclassroom-frontend
    echo "Layanan dijalankan."
    ;;
  logs-backend)
    echo "Menampilkan live logs backend (Ctrl+C untuk keluar)..."
    journalctl -u smartclassroom-backend -f
    ;;
  logs-frontend)
    echo "Menampilkan live logs frontend (Ctrl+C untuk keluar)..."
    journalctl -u smartclassroom-frontend -f
    ;;
  logs-db)
    echo "Menampilkan live logs PostgreSQL Docker (Ctrl+C untuk keluar)..."
    sudo docker compose logs -f db
    ;;
  *)
    echo "Penggunaan: ./manage.sh {status|restart|start|stop|logs-backend|logs-frontend|logs-db}"
    exit 1
    ;;
esac

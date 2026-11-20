#!/bin/sh
# cek-api.sh: uji endpoint FlowGanic lalu bandingkan dengan kode HTTP yang diharapkan.
#   sh cek-api.sh                                   gateway lokal di laptop/STB
#   sh cek-api.sh https://flowganic.stei.fun/api    URL publik setelah tunnel aktif
# Isi API_KEY bila microservice sudah memakai kunci:
#   API_KEY=xxx sh cek-api.sh

BASE="${1:-http://127.0.0.1:8080/api}"
UA="FlowGanic-cek/1.0"
GAGAL=0

if [ -n "$API_KEY" ]; then
  KUNCI="-H X-API-Key:$API_KEY"
else
  KUNCI=""
fi

cek() {
  nama=$1 harap=$2 kode_metode=$3 jalur=$4 data=$5
  if [ "$kode_metode" = "POST" ]; then
    kode=$(curl -gs -m 15 -A "$UA" $KUNCI -o /tmp/cek-api.out -w '%{http_code}' \
      -X POST -H 'Content-Type: application/json' -d "$data" "$BASE$jalur")
  else
    kode=$(curl -gs -m 15 -A "$UA" $KUNCI -o /tmp/cek-api.out -w '%{http_code}' "$BASE$jalur")
  fi
  if [ "$kode" = "$harap" ]; then
    printf '%-22s %s OK\n' "$nama" "$kode"
  else
    printf '%-22s %s GAGAL (harap %s)\n' "$nama" "$kode" "$harap"
    GAGAL=$((GAGAL + 1))
  fi
}

echo "Base URL: $BASE"
echo

cek health           200 GET  "/health"
cek halte            200 GET  "/halte"
cek rute             200 GET  "/rute?asal=blok-m&tujuan=manggarai"
cek eta              200 GET  "/eta?halte_id=blok-m"
cek risiko-transfer  200 POST "/risiko-transfer" '{"sisa_menit":4,"waktu_jalan_menit":5}'
cek eta-tanpa-param  400 GET  "/eta"
cek halte-asing      404 GET  "/eta?halte_id=xx"
cek endpoint-asing   404 GET  "/nope"

echo
if [ "$GAGAL" -eq 0 ]; then
  echo "Semua pemeriksaan lulus."
else
  echo "$GAGAL pemeriksaan gagal."
fi
rm -f /tmp/cek-api.out
exit "$GAGAL"

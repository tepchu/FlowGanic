#!/bin/sh
# cek-api.sh: uji endpoint FlowGanic dari pengajuan sampai konfirmasi volume.
#   sh cek-api.sh                                   gateway lokal
#   sh cek-api.sh https://kononkatanya.stei.fun/api URL publik
# Isi API_KEY bila layanan memakai kunci:
#   API_KEY=xxx sh cek-api.sh

BASE="${1:-http://127.0.0.1:8080/api}"
UA="FlowGanic-cek/1.0"
GAGAL=0

if [ -n "$API_KEY" ]; then KUNCI="-H X-API-Key:$API_KEY"; else KUNCI=""; fi

# BSD (macOS) dan GNU (Armbian) berbeda cara menambah hari.
JADWAL=$(date -v+3d +%F 2>/dev/null || date -d '+3 days' +%F)
REF="uji-$$"

cek() {
  nama=$1 harap=$2 metode=$3 jalur=$4 data=$5
  if [ -n "$data" ]; then
    kode=$(curl -gs -m 20 -A "$UA" $KUNCI -o /tmp/cek-api.out -w '%{http_code}' \
      -X "$metode" -H 'Content-Type: application/json' -d "$data" "$BASE$jalur")
  else
    kode=$(curl -gs -m 20 -A "$UA" $KUNCI -o /tmp/cek-api.out -w '%{http_code}' \
      -X "$metode" "$BASE$jalur")
  fi
  if [ "$kode" = "$harap" ]; then
    printf '%-26s %s OK\n' "$nama" "$kode"
  else
    printf '%-26s %s GAGAL (harap %s)\n' "$nama" "$kode" "$harap"
    GAGAL=$((GAGAL + 1))
  fi
}

echo "Base URL: $BASE"
echo "Jadwal uji: $JADWAL, penghasil: $REF"
echo

cek health              200 GET  "/health"
cek wilayah             200 GET  "/wilayah"
cek pengolah            200 GET  "/pengolah"
cek pengolah-disaring   200 GET  "/pengolah?wilayah_id=rw05-lebak-siliwangi&jenis=ORGANIK"
cek rekap               200 GET  "/rekap"

AJU="{\"penghasil_ref\":\"$REF\",\"wilayah_id\":\"rw05-lebak-siliwangi\",\"jenis\":\"ORGANIK\",\"perkiraan_kg\":20,\"jadwal\":\"$JADWAL\"}"
cek ajukan-permintaan   201 POST "/permintaan" "$AJU"
ID=$(sed -n 's/.*"id": *"\([^"]*\)".*/\1/p' /tmp/cek-api.out)

cek ajukan-ulang        200 POST "/permintaan" "$AJU"
if [ -n "$ID" ]; then
  cek lacak-permintaan  200 GET  "/permintaan/$ID"
  cek konfirmasi-volume 200 PATCH "/permintaan/$ID" '{"aksi":"selesai","volume_kg":23}'
  cek sudah-final       400 PATCH "/permintaan/$ID" '{"aksi":"selesai","volume_kg":23}'
else
  printf '%-26s     GAGAL (id permintaan tidak terbaca)\n' "lacak-permintaan"
  GAGAL=$((GAGAL + 3))
fi

cek jenis-tidak-dikenal 400 GET  "/pengolah?jenis=KACA"
cek wilayah-asing       404 POST "/permintaan" "{\"penghasil_ref\":\"$REF-x\",\"wilayah_id\":\"rw99\",\"jenis\":\"ORGANIK\",\"perkiraan_kg\":5,\"jadwal\":\"$JADWAL\"}"
cek permintaan-asing    404 GET  "/permintaan/tidak-ada"
cek endpoint-asing      404 GET  "/entah"

echo
if [ "$GAGAL" -eq 0 ]; then echo "Semua pemeriksaan lulus."; else echo "$GAGAL pemeriksaan gagal."; fi
rm -f /tmp/cek-api.out
exit "$GAGAL"

# Admin PT.UTP — Terrasentra Bandung

Aplikasi administrasi proyek untuk satu admin. PM: Juhana · kode proyek: TRSM-51D26-D-M.

**Mulai dari [panduan proyek](panduan/MULAI-DI-SINI.md), lalu baca [checkpoint break terbaru](panduan/STATUS-BREAK.md).** Checkpoint menjelaskan pekerjaan yang selesai, yang belum diperiksa, dan titik melanjutkan dari komputer lain.

## Isi folder

| Folder | Isi |
| --- | --- |
| `aplikasi/` | Kode aplikasi aktif: memo, RPB, RPD, material, dan komponen bersama |
| `alat/` | Skrip untuk menyiapkan sumber, membuat pratinjau, memeriksa hasil, dan mengekspor riwayat |
| `pengujian/` | Tes kontrak dan aturan aplikasi |
| `pratinjau/` | Tampilan lokal dan prototipe; bukan deployment produksi |
| `panduan/` | Keputusan proyek, checkpoint, laporan, masukan AI, dan riwayat percakapan |
| `data-referensi/` | Petunjuk master item dan contoh sintetis, bukan master asli |
| `arsip/` | Salinan kode/panduan lama yang dipertahankan untuk rujukan |
| `graphify-out/` | Peta kode hasil alat; jangan disunting sebagai kode aplikasi |

Lihat [peta folder dan perubahan nama](panduan/STRUKTUR-FOLDER.md) bila catatan lama menyebut lokasi berbeda.

## Perintah lokal

Jalankan dari folder utama repository:

```powershell
node alat/buat-sumber-clasp.js
python alat/buat-pratinjau.py
node --test pengujian/rpb-kontrak.test.js pengujian/material-domain.test.js pengujian/material-penyimpanan.test.js
```

Hasil pratinjau: `pratinjau/aplikasi.html`. Prototipe mandiri: `pratinjau/prototipe-material.html`. Data simulasi tidak tersimpan ke server.

Nama file yang dikirim ke Apps Script tetap `Memo.gs`, `Index.html`, dan nama partial yang sudah ada. Struktur folder hanya untuk repository; `alat/buat-sumber-clasp.js` menyiapkan file datar di `.clasp-src/`. Perintah build tidak melakukan push/deployment.

## Melanjutkan dari perangkat lain

Buka task Codex Cloud yang terhubung `defeoni/botutpiqbal`, atau clone repository di komputer lain. Gunakan main terbaru setelah memeriksa perubahan lokal. Minta AI membaca AGENTS.md, panduan proyek, dan checkpoint break. Chat lokal tidak otomatis dipulihkan ke sidebar; ekspor pesan tersedia di `panduan/riwayat/`.

Master asli, Excel template di Downloads, kredensial, cache, dan file privat `.local/` tidak termasuk backup Git. Folder `.git/`, `.clasp-src/`, `.local/`, `.venv/`, dan `.codex/` dikelola alat dan tidak perlu dirapikan manual.

Memo/RPB sudah ada; frontend material terintegrasi masih perlu pemeriksaan lanjutan dan kontrak backend per item. Tidak ada klaim runtime cloud atau deployment baru berhasil. Rincian dan hasil tes aktual ada di checkpoint.

## Burst draf per item

Kontrak draf Material dan batas aktivasi ada di `panduan/KONTRAK-DRAF-MATERIAL.md`; hasil terkini di `panduan/STATUS-BREAK.md`. Penyimpanan draf server tersedia di kode dengan capability default nonaktif. Review/revisi/final live belum tersedia. Uji integrasi lokal: `node alat/periksa-draf-material.cjs <path-playwright> <path-browser>`, sesudah build sumber dan preview. Alat memakai adapter/domain nyata dengan layanan Google tiruan, tanpa akses Google.

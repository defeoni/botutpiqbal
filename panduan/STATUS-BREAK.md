# Checkpoint break — baca ini setelah MULAI-DI-SINI

Pekerjaan dihentikan atas instruksi pengguna untuk berpindah perangkat. Ini checkpoint parsial, bukan rilis produksi. Jangan meneruskan mode burst otomatis.

## Aturan kerja terbaru

- **Break dan lakukan backup**: hentikan implementasi/agen, perbarui catatan dan ekspor pesan tersedia, commit/push GitHub, verifikasi remote, lalu berhenti.
- **Burst** hanya ketika pengguna meminta secara eksplisit. Kerjakan satu hasil yang jelas, uji, laporkan singkat, tanyakan kelanjutan. Dalam burst subagent diperbolehkan; pengguna telah mengizinkan lebih dari satu untuk frontend.
- AI eksternal (Gemini, Claude, ChatGPT web) tidak mempunyai akses folder. Mereka menghasilkan rancangan/file/review yang dikirim pengguna; Codex/Copilot yang mengintegrasikan. Copilot VS Code limit hampir habis, jadi Codex mengambil alih tugas.
- Chat lokal Brainstroming belum muncul di komputer rumah berdasarkan tes pengguna. Jangan menjanjikan sinkronisasi chat lokal. Gunakan task Cloud + repository + catatan; ekspor bukan impor otomatis sidebar.

## Hasil yang benar-benar selesai dan diuji

1. Backend material diperbaiki Copilot: import tervalidasi/upsert, konteks setelah lock, folder upload privat, bukti HO terlindungi, audit konsisten, settings hanya favorites dan PIN. Laporan disalin ke `laporan/MATERIAL-BACKEND-RESULT.md`.
2. Codex benar-benar menjalankan `node --test tests/utp-domain.test.js tests/utp-storage.test.js tests/rpb-contract.test.js`: **45/45 lulus** lokal, memakai mock layanan Google.
3. `preview/material-prototype.html` mandiri selesai diperbaiki Codex dari hasil Gemini. `tools/check_material_prototype.cjs` benar-benar dijalankan dengan Chrome headless/Playwright yang tersedia: **17/17 skenario lulus**, termasuk layout desktop/ponsel. Lihat `laporan/MATERIAL-PROTOTYPE-RESULT.md`.

## Frontend terintegrasi: sudah ditulis, BELUM selesai diverifikasi

- `utp/UtpView.html` dan `utp/UtpStyles.html`: shell/status/dialog, tema teal scoped, responsive; subagent sudah menyelesaikan dan membaca ulang. Tidak diuji browser sebagai integrasi.
- `utp/UtpClient.html`: frontend IIFE untuk CATALOG, APPROVALS, REQUESTS, ARRIVAL. File telah ditulis; agen sedang menyelesaikan pemeriksaan lifecycle dialog ketika diinterupsi. Jangan menganggapnya final karena file sudah ada.
- Root sudah mengubah navigasi `shared/Index.html`, CTA `shared/HomeView.html`, bridge/navigasi `memo/MemoClient.html`, daftar build dan pembuat preview.
- `tools/check_material_frontend.cjs` sudah dibuat, **BELUM DIJALANKAN**. Jangan menyatakan tes frontend terintegrasi sudah lulus.
- `preview/Index-demo-lokal.html` belum dibangun ulang dengan frontend terbaru; masih hasil lama. `.clasp-src/` ignored dan belum dibangun ulang untuk pekerjaan frontend ini.
- Build Apps Script sekarang mencantumkan UtpDomain/Utp serta UtpView/UtpStyles/UtpClient, tetapi belum ada deployment. Konfigurasi Apps Script tidak diubah.

## Batas integrasi yang penting

Backend existing menyimpan otoritas/jalur permintaan pada level dokumen dan memvalidasi item dengan daftar field terbatas. Keputusan terbaru memerlukan classification, requiredAuthority, keputusan per pihak dan cakupan bukti HO PER ITEM. Backend saat ini belum menyediakan kontrak lengkap itu; tes backend yang lulus tidak membuktikan kontrak UI baru sudah tersedia.

Karena itu frontend baru sengaja:

- Dalam preview lokal eksplisit (`UTP_FRONTEND_PREVIEW=true` hanya ditambahkan pembuat preview), interaksi memakai data sintetis memori halaman. Tidak tersimpan ke server, hilang saat reload/logout.
- Pada sumber produksi tanpa flag, hanya membaca bootstrap/search/list/detail; mutasi material dinonaktifkan. Jangan memaksa pengiriman field baru melalui backend lama yang akan membuang detailnya.
- Tidak menggunakan data contoh sebagai fallback bila API nyata gagal.

## Pemeriksaan berikutnya ketika pengguna melanjutkan

1. Baca ulang UtpClient dan selesaikan integrasi browser secara terarah. Agen terakhir mengatakan lifecycle close/reopen dialog dan submit edge cases sedang diperiksa; tentukan apakah perbaikannya sudah tertulis dari kode, bukan asumsi.
2. Periksa `render()` tidak membuka kembali `utpApp` ketika callback async selesai setelah pengguna pindah ke Memo/RPB. Visibilitas halaman sebaiknya dimiliki navigasi utama.
3. Periksa hasil search server untuk merek kosong: jangan menganggap UNKNOWN generik/approved hanya karena backend mencocokkan approval generic dengan brand kosong.
4. Periksa validasi tanggal kalender dan penggunaan WIB di frontend.
5. Build lokal: `node tools/build_clasp_source.js`; `python tools/build_local_preview.py`.
6. Jalankan browser check frontend, lalu tambah pemeriksaan tindakan nyata draf/review/revisi/konflik sesuai selector di bawah. Jangan mengulang seluruh tes backend tanpa perubahan/concern baru; hasil 45/45 sudah nyata pada checkpoint ini.
7. Periksa live read-only/error tidak memuat fallback demo dan tidak mengirim mutasi. Cloud runtime/login/izin tetap belum diverifikasi.
8. Setelah frontend stabil, kontrak backend per item adalah tugas terpisah sebelum mengaktifkan penyimpanan cloud. Jangan deploy untuk menguji tebakan.

Selector frontend yang diberikan agen: `[data-action=new-request]`, `#utpRequestFields [name=title/date/number/note]`, `[data-action=add-master/add-temporary]`, `#utpLookupQuery`, `[data-action=lookup-select]`, `#utpDialogForm` nama classification/requiredAuthority/quantity/unit/party/decision/reason; aksi save-request, submit-request, edit-item, choose-original, add-final-file, show-final, finalize-request, publish-revision, simulate-failure, simulate-conflict. `window.UTPFrontend.getState()` mengembalikan clone state untuk pemeriksaan. Cocokkan selector dengan file aktual.

Browser checks memakai Playwright bundled dari runtime Codex dan Chrome yang sudah terpasang. Temukan path dengan tool dependency runtime; contoh invocation dapat dilihat di komentar kedua skrip check. Tidak ada instalasi dependency baru.

## Graphify dan alasan jeda

Tidak ada rebuild source map pada burst frontend ini. Parent menjalankan query `python tools/build_code_graph.py --query apiUtp --budget 1000`, selesai sekitar dua detik termasuk membaca instruksi skill. Source map tidak berubah di Git. Waktu lama terutama penulisan/review frontend client oleh subagent, bukan bukti proses Graphify macet.

Graph yang ada bisa basi untuk file frontend baru. **Tidak perlu rebuild untuk backup atau sekadar melanjutkan checkpoint.** Baca file tertentu/query peta yang ada; rebuild hanya bila bermanfaat dan sesuai cakupan.

## Kelengkapan backup

Backup Git mencakup kode/checkpoint parsial, panduan, laporan dan ekspor pesan user/asisten lokal yang tersedia sampai saat ekspor. Tidak termasuk rahasia, cache, `.clasp-src/`, seluruh output alat, gambar biner, file Excel Downloads, atau otomatis semua lampiran chat. Master asli masih di PC kantor; gunakan penyimpanan privat bila perlu dipindah.

Saat ekspor berikutnya dibuat, pesan penutup setelah ekspor tentu belum termasuk. Tidak ada klaim chat lama bisa dimunculkan kembali di sidebar Cloud.

## Prompt pindah perangkat

```text
Lanjutkan proyek defeoni/botutpiqbal dari main terbaru. Periksa perubahan lokal sebelum memperbarui checkout; jangan menimpa pekerjaan.
Baca AGENTS.md, panduan/MULAI-DI-SINI.md, lalu panduan/STATUS-BREAK.md (status terbaru mengungguli catatan lama).
Orientasi dulu, jangan coding/deploy/burst otomatis. Ringkas hasil selesai, pekerjaan frontend yang belum diuji, dan batas kontrak backend per item. Graphify tidak perlu rebuild untuk orientasi ini.
```

# Checkpoint break — 17 Oktober 2026

**Status: PAUSE / BREAK.** Pengguna meminta commit seluruh pekerjaan, backup GitHub, dan prompt untuk perangkat lain. Mode burst berakhir; jangan melanjutkan coding otomatis.

## Baca berurutan

1. `AGENTS.md` — aturan kerja.
2. `panduan/MULAI-DI-SINI.md` — tujuan dan keputusan bisnis.
3. Dokumen ini — progres terkini, mengungguli laporan historis.
4. `panduan/STRUKTUR-FOLDER.md` — nama/lokasi baru dan pemetaan lokasi lama.

## Yang selesai

- Penataan folder: sumber aktif di `aplikasi/{bersama,material,memo,rpb,rpd}/`; alat di `alat/`; tes di `pengujian/`; tampilan contoh di `pratinjau/`; contoh data di `data-referensi/`; kode/panduan lama di `arsip/`.
- Nama alat dan laporan dibuat lebih mudah dibaca. README utama dan HANDOFF kini pintu masuk singkat; referensi lama dipertahankan di arsip.
- Saat pemindahan awal, 81 berkas tracked diperiksa SHA256: isi tidak berubah akibat move. Skrip build/tes dan petunjuk kemudian disesuaikan jalurnya.
- Nama fungsi/partial dan nama file datar Apps Script tetap sama. Kode bisnis aktif tidak diubah pada tugas penataan.
- Backend material/RPB telah diperbaiki dan diuji. Laporan: `panduan/laporan/backend-material.md`, `perbaikan-rpb.md`, `beranda-dan-login.md`.
- Prototipe material mandiri selesai diperbaiki; laporan `panduan/laporan/prototipe-material.md`.

## Bukti aktual setelah penataan

- `node alat/buat-sumber-clasp.js`: berhasil menyiapkan **17 file** di `.clasp-src/`.
- `python alat/buat-pratinjau.py`: berhasil membuat `pratinjau/aplikasi.html`.
- `node --test pengujian/rpb-kontrak.test.js pengujian/material-domain.test.js pengujian/material-penyimpanan.test.js`: **45/45 lulus** lokal/mock, bukan bukti runtime Google.
- `alat/periksa-prototipe-material.cjs` dijalankan dengan Playwright bundled/Chrome headless: **17/17 skenario lulus**.
- Self-test `alat/peta-kode.py` dan `alat/siapkan-master-item.py` lulus. Peta TIDAK dibangun ulang.
- `alat/periksa-frontend-material.cjs` benar-benar dijalankan: **11 pemeriksaan awal berhasil, lalu gagal pada CATALOG viewport 390px** karena halaman melebar. Pemeriksaan sesudah titik gagal belum dijalankan. Jangan menuliskan frontend terintegrasi lulus penuh.
- `git diff --check` pada perubahan tracked saat pemeriksaan lulus; peringatan LF/CRLF bukan kegagalan tes.

## Titik pause dan pekerjaan berikutnya

**Tugas berikutnya adalah menyelesaikan verifikasi frontend terintegrasi, dimulai dari overflow Katalog pada ponsel 390px.** Bug ditemukan saat pemeriksaan penataan, belum diperbaiki agar tidak memperluas tugas terakhir.

1. Setelah pengguna meminta lanjut, reproduksi dengan `alat/periksa-frontend-material.cjs`. Periksa container/grid/table dan min-width di `aplikasi/material/UtpStyles.html`, `aplikasi/bersama/Styles.html`, dan HTML render Katalog di `aplikasi/material/UtpClient.html`. Jangan menyembunyikan masalah dengan menghapus tes.
2. Periksa lifecycle dialog dan submit edge cases. Agen frontend sebelumnya dihentikan ketika meninjau hal ini; file sudah tertulis tetapi hasilnya belum dianggap final.
3. Periksa callback async `render()` tidak membuka kembali material setelah pengguna pindah ke Memo/RPB.
4. Periksa hasil pencarian server untuk brand kosong tidak otomatis dianggap generik/approved. Konfirmasi generik harus eksplisit.
5. Periksa tanggal kalender dan WIB. Uji alur nyata membuat draf, mencari item, review per item, revisi, bukti HO multi-item, error/conflict, serta navigasi Memo/RPB.
6. Sesudah perubahan terkait, rebuild lokal dan jalankan tes terarah yang relevan. Jangan mengulang semua tes atau rebuild Graphify tanpa alasan baru.
7. Kontrak backend per item adalah pekerjaan tersendiri setelah frontend stabil; jangan mengaktifkan penyimpanan live dengan kontrak lama.

## Batas integrasi cloud yang belum selesai

Backend saat ini menyimpan jalur/otoritas pada level dokumen dan belum mempertahankan seluruh classification, requiredAuthority, keputusan pihak, serta cakupan final HO PER ITEM yang diperlukan UI terbaru.

Frontend `aplikasi/material/UtpClient.html` sengaja memakai simulasi memori dalam preview lokal eksplisit `UTP_FRONTEND_PREVIEW=true`; data hilang saat reload/logout. Sumber produksi tanpa flag hanya boleh membaca bootstrap/search/list/detail; mutasi material dinonaktifkan agar data tidak hilang melalui kontrak lama. API gagal tidak boleh diganti data contoh secara diam-diam.

Autentikasi/PIN, Drive/Sheets/Gmail runtime dan identitas/daftar file cloud belum diverifikasi. Tidak ada deployment atau perubahan konfigurasi Apps Script pada tugas ini. Sebelum deployment kelak, verifikasi target Apps Script, snapshot/daftar file cloud, akses pemilik dan langkah pemulihan.

## Alat untuk verifikasi berikutnya

Kedua skrip browser menerima path paket Playwright dan executable browser sebagai argumen; temukan dependency runtime yang tersedia, tanpa memasang framework baru. Tidak menghubungi layanan Google pada pemeriksaan lokal.

Selector: `[data-action=new-request]`, `#utpRequestFields [name=title/date/number/note]`, `[data-action=add-master/add-temporary]`, `#utpLookupQuery`, `[data-action=lookup-select]`, `#utpDialogForm`; aksi save-request, submit-request, edit-item, choose-original, add-final-file, show-final, finalize-request, publish-revision, simulate-failure, simulate-conflict. `window.UTPFrontend.getState()` mengembalikan clone state.

## Graphify

Pada penataan, lokasi sumber di `graphify-out/code-graph.json` dan SOURCE_MAP disesuaikan secara mekanis; jumlah node/edge tetap. Tidak ada ekstraksi ulang, clustering, atau rebuild. Hash/nomor baris dan cakupan file baru mungkin basi; periksa sumber nyata. Keluaran Graphify lain tetap snapshot lama.

Query orientasi terbatas:
`python alat/peta-kode.py --query apiUtp --budget 1000`.
Jangan menjalankan skrip tanpa opsi query/self-test hanya untuk orientasi, karena mode tanpa opsi memang membangun peta.

## Aturan kerja dan perpindahan perangkat

- Burst hanya setelah konfirmasi eksplisit; subagent diperbolehkan ketika pengguna mengizinkan burst. Selesaikan satu hasil, laporkan singkat, lalu minta arahan.
- Break berarti hentikan implementasi/agen, simpan catatan dan ekspor pesan tersedia, commit/push, verifikasi, lalu berhenti.
- AI web eksternal tidak punya akses folder. Hasilnya dikirim pengguna, kemudian Codex/Copilot meninjau dan mengintegrasikan. Copilot limit hampir habis, Codex mengambil alih.
- Chat lokal Brainstroming tidak otomatis muncul di komputer rumah berdasarkan tes pengguna. Gunakan task Cloud atau checkout repository + panduan. Ekspor tidak mengimpor chat ke sidebar.
- Backup mencakup sumber, catatan, laporan dan pesan user/asisten lokal yang tersedia saat ekspor. Excel asli di Downloads, gambar biner, seluruh output alat, kredensial, cache, `.local/` dan `.clasp-src/` tidak ikut Git. Jangan klaim seluruh lampiran asli sudah dipindahkan.
- Riwayat dan laporan lama boleh menyebut lokasi lama; terjemahkan dengan STRUKTUR-FOLDER. Keputusan bisnis terbaru mengungguli masukan AI historis.

## Prompt perangkat berikutnya

```text
Saya melanjutkan Admin PT.UTP dari perangkat berbeda.
Gunakan main terbaru repository defeoni/botutpiqbal. Periksa perubahan lokal sebelum memperbarui checkout; jangan menimpanya.

Baca AGENTS.md, panduan/MULAI-DI-SINI.md, panduan/STATUS-BREAK.md dan panduan/STRUKTUR-FOLDER.md.
Laporkan singkat kesiapan dan titik pause. Proyek sedang break; jangan coding, deploy, mengaktifkan burst atau rebuild Graphify otomatis.

Pekerjaan berikutnya setelah saya meminta lanjut: perbaiki overflow Katalog pada ponsel 390px dan selesaikan pemeriksaan frontend terintegrasi. Backend per-item/live belum siap; jangan mengaktifkan mutasi cloud.
```

# Hasil integrasi login dan Beranda Admin PT. UTP

## Status

- **Tahap 1 — Login dan build: selesai secara lokal.** Form login memakai kontrak `apiCreateSession({password})` dari `shared/Auth.gs`; input dikosongkan segera setelah pemanggilan, tidak disimpan ke storage browser atau log. Kegagalan menampilkan pesan dan memungkinkan percobaan ulang. Reset counter sekarang meminta PIN dan mengirim argumen sesuai kontrak backend.
- **Tahap 2 — Beranda dan navigasi: selesai secara lokal.** Beranda menjadi halaman awal setelah autentikasi lokal. Memo, RPB, dan placeholder RPD tetap dapat dinavigasi. Dashboard responsif, tanggal berjalan dinamis, data contoh diberi label, dan modul tanpa implementasi tidak memiliki tautan aktif.

## File yang berubah

- `shared/Index.html` — gerbang login, shell aplikasi, sidebar dan include Beranda.
- `shared/HomeView.html` — ringkasan, contoh permintaan, tugas/log Telegram belum terhubung, serta batasan Barang Datang.
- `shared/Styles.html` — gaya teal, layout desktop, dan aturan responsif.
- `memo/MemoClient.html` — login/retry, awal Beranda, navigasi, tanggal, dan PIN reset counter.
- `tools/build_clasp_source.js` — memasukkan `shared/Auth.gs` dan `shared/HomeView.html` ke `.clasp-src/`.
- `tools/build_local_preview.py` — memasukkan partial Beranda ke pratinjau lokal.
- `preview/Index-demo-lokal.html` — hasil build pratinjau lokal.

Tidak mengubah `shared/Auth.gs`, backend RPB/Memo, `utp/`, atau konfigurasi Apps Script.

## Verifikasi yang dijalankan

- `node tools/build_clasp_source.js` — berhasil; 12 file disiapkan.
- Pemeriksaan integrasi Node — berhasil: Auth dan Home ada di staging, kontrak credential sesuai, PIN reset dikirim, rute HOME/MEMO/RPB/RPD tersedia, skrip client lolos parse, partial pratinjau terdaftar.
- `node --check tools\build_clasp_source.js` — berhasil.
- Pemeriksaan sintaks Pylance untuk `tools/build_local_preview.py` — tidak ada kesalahan.
- Build `tools/build_local_preview.py` — berhasil.
- `node --test tests\rpb-contract.test.js` — lulus, 7/7.
- `git diff --check` pada berkas implementasi — lulus.
- Pratinjau browser lokal: desktop 1440×900 dan ponsel 390×844. Beranda tampil; kartu ponsel dua kolom; tabel dapat digeser; tidak ada overflow horizontal; tanggal dinamis. Rute HOME, MEMO, RPB, RPD diuji di browser.
- Form login diuji dengan nilai uji lokal pada preview tanpa backend: pesan kegagalan jelas, input dikosongkan, form tetap tersedia untuk mencoba lagi. Tidak ada permintaan autentikasi yang dikirim.

## Batasan dan langkah integrasi berikutnya

Autentikasi, PIN, layanan Memo/RPB, dan data produksi **tidak diuji terhadap Apps Script/cloud**. Pratinjau membuka shell secara lokal tanpa mengirim permintaan login. Ringkasan Beranda adalah data contoh statis; Tugas dan Log Telegram belum terhubung; modul lain yang belum tersedia tetap berlabel demikian.

Langkah berikutnya: tinjau staging `.clasp-src/`, pastikan konfigurasi akses pemilik melalui prosedur yang sudah ada di project, lalu lakukan deployment dan verifikasi login/PIN melalui URL Apps Script hanya oleh pihak yang berwenang. Tidak ada commit, push, atau deployment dalam tugas ini.

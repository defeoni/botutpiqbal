# BOT UTP IQBAL

Buka halaman: http://127.0.0.1:8765/aplikasi.html

- aplikasi/: sumber Apps Script, HTML dan CSS.
- alat/: build, preview, pemeriksaan browser, konverter master.
- pengujian/: tes aturan dan penyimpanan.
- ATURAN.md: kebutuhan bisnis; baca bagian terkait saja.
- KONTRAK.md: kontrak draf per item; baca saat mengubah penyimpanan.

Build lokal:
```
node alat/buat-sumber-clasp.js
python alat/buat-pratinjau.py
python -m http.server 8765 --bind 127.0.0.1 --directory .local
```
Preview material memakai data ilustrasi memori; jangan menganggapnya data server. Aplikasi live memakai login/PIN, ringkasan server, Memo/RPB, material per item, RPD serta catatan Tugas/Keuangan/Arsip/Absensi serta direktori Manpower HO. Status pengajuan/review dicatat admin, bukan persetujuan atau pengiriman otomatis. Modul material dapat dinonaktifkan melalui UTP_MATERIAL_DRAFTS_ENABLED=false.

Master resmi perlu diimpor melalui Katalog → Impor master CSV; contoh CSV bukan master asli. Template perusahaan RPD/absensi dan integrasi pengingat Telegram belum dianggap selesai tanpa format/config akun terkait. Mobile ditunda. Jalankan tes hanya sesuai izin pengguna; Google runtime perlu dibedakan dari tes layanan mock.

Navigasi memakai ruang kerja Proyek/HO dengan pengaturan masing-masing. Data Manpower berada di HO. Kedua beranda memuat Kanban ringkasan dari status dokumen aktual; perpindahan proses material dilakukan pada papan lengkap.

# BOT UTP IQBAL

Buka halaman: http://127.0.0.1:8765/aplikasi.html

- aplikasi/: 17 sumber aktif Apps Script, HTML dan CSS.
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
Preview memakai data ilustrasi memori. Draf server tersedia di kode tetapi default nonaktif; review/revisi/final live belum aktif. Google runtime belum diverifikasi. Bukti terakhir: 89 tes kode, 19 pemeriksaan frontend dan 4 integrasi mock lulus.

Prioritas sekarang: pengguna melihat halaman. Selesai satu tugas, berhenti. Arsip/riwayat/peta lama dapat dipulihkan dari Git sebelum perapian; bukan konteks wajib.

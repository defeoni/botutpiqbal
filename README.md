# BOT UTP IQBAL

## Cloudflare — frontend Project Memory

Frontend AI Studio sekarang berada di `cloudflare/frontend/src/`; cara build,
deploy, pemulihan metadata, batas pilot, dan lanjutan produksi ada di
`cloudflare/frontend/README.md`. Build dari root dengan `npm run build`, deploy
dengan `npm run cloudflare:deploy`. Apps Script lama tetap terpisah.

Pilot: https://utp-project-memory.mini-garden.workers.dev (metadata lokal/data contoh;
berkas Drive/Sheets produksi belum dipindahkan).

## Alat lokal dan pemeriksaan finishing (Windows)

Pada PC ini Node/npm, clasp, dan Python portable berada di `.local/tools/`
(diabaikan Git). Untuk mengaktifkannya pada PowerShell sesi berjalan:

```powershell
. ./alat/aktifkan-alat.ps1
```

Jika Windows memblokir skrip, jalankan pemeriksaan dalam proses terpisah:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File alat/periksa-rilis.ps1
```

Perintah tersebut menjalankan generator clasp, tes backend dan Project Memory,
generator preview, delapan pemeriksaan browser Apps Script dengan layanan Google
simulasi, lalu build React dan Playwright desktop. Kegagalan menghentikan proses;
hasil lokal bukan bukti runtime Google. Chrome/Edge terpasang dipakai otomatis,
atau tentukan `CHROMIUM_BIN`. Dependency proyek disiapkan dengan `npm.cmd ci`.
PC lain perlu memasang alat tersebut sendiri; berkas portable tidak ikut clone.

Login Google dilakukan sekali dengan `clasp.cmd login`, lalu verifikasi akses
dengan `clasp.cmd show-authorized-user` dan `clasp.cmd list-deployments`.
Kredensial disimpan di profil pengguna, tidak boleh masuk repository. Untuk
GitHub CLI gunakan `gh auth login --hostname github.com --git-protocol https --web`.
Koneksi plugin chat dan login CLI merupakan akses yang terpisah.

Saat diminta `finishing`, ikuti AGENTS.md: perbarui source, tes lokal yang relevan,
perbaiki kegagalan, upload dengan `clasp.cmd`, perbarui deployment web app yang ada,
lalu commit/push ke GitHub dan laporkan versi/URL. Pemeriksaan gabungan di atas
hanya digunakan bila seluruh cakupannya relevan. Skrip pemeriksaan tidak melakukan
commit, push, upload, atau deployment. `.clasp.json` hanya menerbitkan sumber
Apps Script lama; frontend React di `cloudflare/frontend/src/` diterbitkan lewat Cloudflare Workers Static Assets.

## UTP Project Memory — prototipe lokal

Frontend baru berada di `cloudflare/frontend/src/` (React/TypeScript/Vite). Jalankan `npm ci`,
`npm run build`, `npm run test:memory`, lalu `npm run dev` untuk membuka port 3000.
Source Apps Script lama di bawah tetap dipertahankan.

Beranda memakai tema putih dengan aksen merah UTP dan miniatur konstruksi SVG
isometrik yang lebih lebar: gedung enam lantai, fasad kaca, rangka terbuka,
perancah, crane pengangkat material, ekskavator, truk dan pekerja bergerak.
Tombol Perbesar membuka miniatur dalam dialog besar (Escape untuk menutup).
Tombol jeda tersedia di kedua tampilan; animasi berhenti
saat bagian tersebut keluar layar dan menghormati `prefers-reduced-motion`.
Statistik mengikuti metadata proyek terpilih; diorama bukan telemetri lapangan.
`npm run test:ui` membangun frontend dan menjalankan Playwright pada desktop
1366/1920px serta pengurangan gerak. Gunakan Chrome/Edge yang terpasang,
`CHROMIUM_BIN`, atau browser Chromium Playwright. Screenshot ada di `.local/`.
Konsep visual: https://www.figma.com/design/82fx6Thcu7WcNTNM6izxAA

Referensi komposisi miniatur: https://education.icograms.com/templates/253/construction-site
dan https://stockcake.com/i/construction-site-miniature_4142299_1862798.
Ilustrasi di source digambar sendiri dengan SVG; tidak memuat aset atau skrip
dari situs referensi. Animasi memakai CSS tanpa library tambahan.

Status: metadata disimpan di localStorage browser, dengan data contoh awal.
Berkas asli belum disimpan/diunggah; Drive, Cloudflare dan Telegram produksi belum terhubung.
Jangan memakai prototipe ini sebagai satu-satunya arsip. Teks `.txt` dapat dibaca;
PDF/Word/Excel/foto belum diekstrak. Nomor dokumen hanya diambil dari teks literal
yang tersedia; data tanpa bukti tetap kosong. Kategori dari nama berkas ditandai
dugaan. Kartu Kanban hanya dibuat jika pengguna memilih ada tindakan.
Lampiran scan/balasan simulasi dinonaktifkan agar tidak menjadi bukti palsu.
Memori baru tidak digabung otomatis berdasarkan nama berkas atau nomor dokumen.
Data browser yang sudah ada tidak dihapus atau ditulis ulang oleh perbaikan ini;
catatan lama dari parser simulasi perlu ditinjau manual.

Backend `7569402` masih menunggu bundle transfer untuk ditinjau dan diuji lokal.
Belum ada deployment. Instruksi deployment di `SERAHAN-CODEX.md` adalah rencana,
bukan izin menjalankannya.

## Aplikasi Apps Script lama

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

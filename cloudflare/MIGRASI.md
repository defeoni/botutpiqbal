# Serahan migrasi Cloudflare

Tanggal: 2026-10-29 WIB. Basis: main 547c9877c011a8bf4c27cb473eed885c8497fd04.

## Status terverifikasi
- Frontend React AI Studio dipindah dari src/ ke cloudflare/frontend/src/; tidak digandakan. Desain/konten utama dipertahankan.
- HTML entry dipindah ke cloudflare/frontend/index.html. Vite/TypeScript/tes diarahkan ke lokasi baru. Root dist/ tetap output build.
- Worker Static Assets: utp-project-memory; URL https://utp-project-memory.mini-garden.workers.dev.
- Konfigurasi deploy: cloudflare/wrangler.jsonc. Wrangler 4.155.0 dipin sebagai devDependency; package-lock.json dipulihkan untuk instalasi npm ci yang konsisten.
- Aset publik berisi contoh bawaan; tidak berisi ekspor Drive/Sheets produksi atau secret.
- Ekspor/impor metadata browser: JSON berversi, validasi sebelum tulis, konfirmasi overwrite ID sama, ekspor kondisi awal, pertahankan ID lain, pemulihan jika penulisan gagal.
- Apps Script/Drive lama tidak diubah atau dimatikan. Tidak ada file bisnis dipindahkan/dihapus.

## Batas migrasi saat ini
Pembaca/penulis pilot: layanan storageService pada browser, namespace localStorage lama tetap sama tetapi origin Cloudflare berbeda. Pembaca/penulis produksi lama: Apps Script dan Google Sheets/Drive. Keduanya belum disinkronkan; pilot bukan pengganti operasional produksi.

Belum ada backend Cloudflare, autentikasi produksi, pemindahan dokumen Sheets, integrasi Drive, penyimpanan berkas asli, OCR/AI, atau Telegram server. Menu Telegram tetap simulator. Upload pilot hanya metadata; jangan menyatakan berkas asli sudah tersimpan.

## Tahap produksi berikutnya (belum dijalankan)
1. Inventaris proyek, ID dokumen, lokasi Sheets dan Drive; jumlah/relasi/riwayat; putuskan pemilik sumber tulis saat cutover.
2. Konfigurasi Google OAuth untuk akses folder Drive asli. Token Apps Script/clasp tidak otomatis menjadi kredensial Worker. Jangan memakai folder publik sebagai jalan pintas.
3. Implementasikan API Worker single-admin yang menolak akses tanpa autentikasi, metadata D1 dengan versi/idempotency, serta upload Drive yang mempertahankan nama asli. Simpan secret melalui Wrangler Secret.
4. Impor satu proyek uji secara idempoten dengan manifest ID asal -> ID baru dan status per item. Jangan hapus sumber. Uji file tetap dapat diakses, arsip pulih, dan jumlah/riwayat cocok.
5. Setelah verifikasi, arahkan penulisan proyek tersebut ke sistem baru. Untuk rollback data setelah cutover, ekspor delta dari sistem baru sebelum kembali ke lama; rollback UI saja tidak cukup.

## Verifikasi rilis
- npm run test:memory: 5 tes lulus (termasuk round-trip metadata, input rusak, rollback kegagalan simpan).
- npm run test:ui: build TypeScript/Vite + 4 tes Playwright lulus.
- URL publik: HTTP 200; HTML publik memiliki SHA256 sama dengan dist/index.html hasil build.
- Playwright desktop 1366 pada URL publik: 1 tes lulus; desain, navigasi dan kontrol miniatur terverifikasi. Versi Worker pertama: 109acaff-c060-4bb1-a2c7-3f15f15d4a5a.
- Source aplikasi/ tidak berubah pada migrasi ini; tidak menjalankan ulang tes Apps Script yang tidak terdampak.

Daftar file: git show --name-status pada commit migrasi. Frontend, konfigurasi build/deploy, pengujian relevan, dokumentasi dan aturan finishing saja; tanpa perubahan data produksi.

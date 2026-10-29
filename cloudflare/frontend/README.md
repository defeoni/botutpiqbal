# UTP Project Memory — Cloudflare

URL pilot: https://utp-project-memory.mini-garden.workers.dev

Source frontend React/Vite dari AI Studio dipindahkan ke folder ini tanpa menggandakan implementasi.
Jalankan semua perintah dari root repository. Dependency dan lockfile berada di root.

```powershell
npm.cmd ci
npm.cmd run dev
npm.cmd run build
npm.cmd run test:memory
npm.cmd run test:ui
npm.cmd exec wrangler login
npm.cmd run cloudflare:deploy
```

- Output build: `dist/` di root. Cloudflare Worker Static Assets: `utp-project-memory`; konfigurasi `cloudflare/wrangler.jsonc`.
- Workers Static Assets menyajikan React, bukan folder `aplikasi/`. Clasp tetap khusus Apps Script lama. Wrangler terbaru mengalihkan pembuatan Pages ke Workers; proyek ini memakai target Workers langsung.
- Fase aktif: pilot frontend. Metadata demo tetap di localStorage browser/domain masing-masing.
- Ekspor metadata mengunduh JSON. Impor tervalidasi mempertahankan dokumen lain dan mengganti ID yang sama setelah konfirmasi serta unduhan cadangan sebelumnya. Bukan backup berkas asli.
- Domain AI Studio, localhost, Apps Script dan Cloudflare memiliki penyimpanan browser berbeda. Browser tidak mengizinkan situs baru mengambil localStorage situs lama. Data di AI Studio perlu diekspor dari origin asal; source lama tetap tersedia dalam riwayat Git.
- Berkas asli, Drive/Sheets, login produksi, OCR/AI, bot Telegram dan pengingat server belum dimigrasikan. Jangan unggah data sensitif ke pilot atau mengandalkannya sebagai arsip tunggal.

Verifikasi browser pada URL terbit dapat memakai `UTP_TEST_BASE_URL` sebelum menjalankan `npm.cmd exec playwright -- test`. Tanpa variabel tersebut, tes memakai preview lokal.

## Lanjutan produksi dan rollback

Pertahankan Apps Script versi aktif beserta berkas Drive asli. Sebelum cutover data: inventaris ID proyek/dokumen/Drive; tentukan akses Google OAuth ke folder asli; buat API Worker terautentikasi dan metadata D1 dengan version checking/idempotency; impor proyek uji; bandingkan jumlah dokumen, relasi, riwayat dan akses file; baru pindahkan pengguna. Jangan menyalin/menghapus berkas asli secara otomatis.

Jika pilot bermasalah, gunakan tautan "Aplikasi lama". Rollback UI melalui deployment Worker sebelumnya atau build commit sebelumnya. Pemulihan kode tidak memulihkan data browser: simpan JSON ekspor. Jangan arahkan penulisan produksi serentak ke dua backend tanpa sinkronisasi yang teruji.

Kontrak target API mengikuti brief UTP-PROJECT-MEMORY-FRONTEND-01: proyek, memori dokumen, lampiran, work card, fakta berbukti dan riwayat; satu identitas dokumen untuk semua versi. Kontrak itu belum merupakan endpoint produksi. Tidak ada secret pada frontend.

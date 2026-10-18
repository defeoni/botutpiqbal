# Pembagian kerja lintas AI — 18 Oktober 2026

Status terbaru: hasil Qwen tanggal/WIB diterima dan diintegrasikan; skenario dari Google AI Studio diterima dan ditinjau. Tabel di bawah adalah rencana awal historis. Codex tidak mengirim pesan langsung ke AI eksternal.

Sumber paket: working tree lokal setelah perbaikan frontend; baseline GitHub 0d4c417 belum mencakup perubahan sesi ini. Jangan memakai main lama untuk menimpa file paket.

| Pelaksana | Tugas | Hak tulis | Status |
|---|---|---|---|
| Qwen / coding agent tersedia | Validasi tanggal kalender dan tampilan WIB | aplikasi/material/UtpClient.html; pengujian/material-tanggal.test.js | Siap dikirim |
| Gemini | Skenario uji revisi, final HO multi-item, gagal/conflict | Tidak mengubah kode; keluaran teks | Siap dikirim |
| Claude | Review hasil Qwen dan temuan Gemini | Tidak mengubah kode; temuan teks | Menunggu hasil |
| Codex | Integrasi patch, tes browser, kontrak pencarian server | Setelah hasil diterima; jangan paralel edit UtpClient | Menunggu hasil |

## Cara pakai

1. Kirim ZIP sumber sesi ini beserta prompt Qwen ke coding agent yang punya akses file. Bila hanya chat web, minta unified diff; jangan menyalin ulang seluruh aplikasi.
2. Kirim ZIP dan prompt Gemini ke Gemini. Tugas ini read-only; dapat berjalan bersama Qwen.
3. Bawa patch/diff Qwen dan laporan Gemini kembali ke chat Codex ini.
4. Codex periksa batas file, integrasikan, lalu jalankan tes. Kirim diff akhir ke Claude bila tersedia; Codex tetap melakukan review bila kuota Claude habis.

Jangan memuat seluruh riwayat atau master asli. Jangan menambah dependency, deploy, clasp push, commit/push, mengubah PIN/auth, atau mengaktifkan mutasi material live. File ZIP hanya sumber relevan dan contoh aplikasi, tanpa konfigurasi rahasia atau master asli.

## Bukti baseline lokal

Frontend 19/19 dan RPB 7/7 lulus pada sesi 18 Oktober. Ini bukti lokal/stub, bukan runtime Google. Perbaikan grid 390px, lifecycle dialog, pengajuan awal dan respons bootstrap terlambat sudah ada pada paket. Jangan mengulang atau membatalkannya.

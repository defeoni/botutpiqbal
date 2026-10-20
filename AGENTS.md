# Cara kerja

- Baca README saja untuk orientasi; ATURAN/KONTRAK hanya bagian relevan. Jangan baca riwayat atau seluruh repo otomatis.
- Prioritas tampilan yang bisa dilihat pengguna; perubahan kecil, tanpa dependency/refactor spekulatif atau minifikasi sumber.
- Fokus PC; mobile ditunda sampai diminta. Tampilan ringan tanpa animasi/transisi tambahan. FE/BE sesuai tugas pengguna. Jangan commit, push, upload, atau deploy tanpa permintaan pengguna.
- Hemat konteks: rg lalu file/fungsi terkait. Kerjakan kebutuhan dan logika dulu; jangan jalankan tes apa pun sampai pengguna meminta. Jangan rebuild peta kode.
- Burst hanya saat diminta, maksimal 3 penulis termasuk Codex bila mengedit; satu file satu pemilik. AI luar tanpa akses GitHub, harus mengirim patch nyata.
- Codex integrasi; tes, commit, push, dan deployment hanya saat diminta. Jangan aktifkan workflow Google belum teruji.
- Selesai satu pekerjaan: lapor hasil lokal, berhenti, tunggu konfirmasi.
- Jika pengguna memberi batch bernomor, tuntaskan seluruh batch berurutan tanpa menunggu konfirmasi per nomor; larangan tes/commit/push/upload/deploy tetap berlaku sampai diminta khusus.
- Izin eksplisit terbaru mengesampingkan default di atas. Jika pengguna menentukan urutan deploy → commit → tes → perbaiki, ikuti urutan itu; hasil koreksi perlu diterbitkan kembali agar deployment sesuai kode akhir.

## Perintah `finishing`

Jika pengguna menulis tepat `finishing`, selesaikan seluruh pekerjaan lokal yang sedang aktif, apa pun modulnya. Jangan meminta prompt lanjutan dan jangan berhenti sebelum proses selesai.

1. Pahami scope perubahan aktif
   - Periksa `git status`, branch, diff, serta file yang berubah.
   - Baca instruksi/progres proyek yang relevan.
   - Tentukan fitur, bug, UI, backend, kontrak, data, atau deployment yang terdampak.
   - Jangan membuang, menimpa, stash, reset, atau mengganti perubahan lokal pengguna.

2. Validasi sesuai perubahan, bukan dengan checklist tetap
   - Jalankan generator/build yang diperlukan oleh file yang berubah.
   - Jalankan test yang relevan, kemudian seluruh suite test bila tersedia dan proporsional.
   - Untuk bug: reproduksi atau buat pemeriksaan yang membuktikan bug sudah selesai.
   - Untuk UI: lakukan pemeriksaan browser/navigasi pada alur yang berubah.
   - Untuk backend/API: uji validasi, error handling, autentikasi, konflik versi, dan integrasi yang terdampak.
   - Untuk template/dokumen: pastikan nama, struktur, file, dan tautan tidak palsu atau rusak.
   - Untuk data: pastikan tidak ada penghapusan/overwrite data tanpa izin.
   - Jika ada test atau pemeriksaan gagal, cari penyebab, perbaiki, lalu ulangi sampai hijau.
   - Jalankan `git diff --check`.

3. Jaga mutu rilis
   - Pastikan source terbaru benar-benar ikut generator/build/deployment; jangan deploy hasil build lama.
   - Jangan mengklaim fungsi live berhasil tanpa bukti.
   - Jangan membuat tautan, data, modul, template, atau status palsu.
   - Jangan menambah dependency, animasi, atau refactor besar tanpa kebutuhan.
   - Jangan membuka atau mencetak token, PIN, maupun kredensial.

4. Commit, push, dan deploy
   - Setelah semua pemeriksaan hijau, buat commit Conventional Commit yang sesuai perubahan.
   - Push ke `origin/main`.
   - Deploy Apps Script menggunakan `clasp.cmd` di PowerShell Windows dan deployment web app yang ada.
   - Verifikasi deployment yang benar, nomor versi, dan URL aplikasi.
   - Bila kredensial/deployment benar-benar tidak tersedia, selesaikan semua langkah lain lalu laporkan blocker yang spesifik.

5. Laporan akhir
   - Ringkas pekerjaan yang selesai.
   - Hash commit dan branch.
   - Hasil test/pemeriksaan.
   - Versi deployment dan URL bila ada.
   - Risiko atau keterbatasan yang masih nyata.

Di luar perintah `finishing`, jangan menjalankan test, commit, push, atau deploy kecuali pengguna memintanya secara eksplisit.

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

## Sinkronisasi Chat Codex dan Codex VS Code

Ada dua lingkungan kerja:

- Chat Codex dapat membuat perubahan kode lalu commit dan push ke `origin/main`.
- Codex VS Code bertugas melakukan finishing dan deployment Apps Script.

### Ketika pengguna menulis tepat: `finishing`

1. Periksa status repository lebih dahulu.
   - Jalankan fetch terhadap `origin`.
   - Periksa branch aktif, HEAD lokal, `origin/main`, dan perubahan lokal.
   - Jangan melakukan hard reset, force push, checkout destruktif, stash otomatis, atau menghapus perubahan pengguna.

2. Sinkronkan commit Chat Codex dengan aman.
   - Bila worktree bersih dan `origin/main` lebih baru, fast-forward/pull `origin/main`.
   - Bila HEAD sudah sama dengan `origin/main`, lanjutkan.
   - Bila ada perubahan lokal milik pengguna atau konflik, jangan menimpa. Laporkan blocker yang spesifik dan jangan deploy source yang belum jelas statusnya.
   - Pastikan commit terbaru dari `origin/main` benar-benar menjadi source yang akan dibangun dan dideploy.

3. Lakukan finishing pada source terbaru.
   - Tentukan pemeriksaan berdasarkan file/perubahan yang ada.
   - Jalankan generator source clasp/preview yang diwajibkan repository.
   - Jalankan test relevan, perbaiki kegagalan, dan ulangi sampai hijau.
   - Jalankan `git diff --check`.
   - Untuk perubahan UI, jalankan pemeriksaan browser/navigasi yang tersedia.
   - Jangan mengklaim fungsi live terbukti bila belum diverifikasi.

4. Rilis.
   - Bila perbaikan finishing menghasilkan perubahan baru, commit dengan Conventional Commit dan push ke `origin/main`.
   - Deploy Apps Script dari source final menggunakan `clasp.cmd` di PowerShell Windows dan deployment web app yang sudah ada.
   - Jangan membuat URL web app baru bila deployment lama dapat diperbarui.
   - Verifikasi nomor versi dan URL deployment.

5. Laporan akhir wajib berisi:
   - Commit yang diambil dari `origin/main`.
   - Commit baru bila ada.
   - Hasil test/pemeriksaan.
   - Versi deployment dan URL.
   - Blocker atau keterbatasan yang nyata.

Di luar perintah `finishing`, jangan menjalankan test, commit, push, pull, atau deploy kecuali pengguna memintanya secara eksplisit.

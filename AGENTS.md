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

Jalankan **Finishing Hemat Token**. Jangan melakukan orientasi ulang, membaca README/riwayat/memory, memakai Graphify/Caveman/Ponytail, audit repository, review diff, atau pencarian luas.

1. Sinkronisasi minimum: `git fetch origin`, lalu fast-forward `main` ke `origin/main`. Jika tidak dapat fast-forward atau ada perubahan lokal, berhenti dan tampilkan blocker singkat.
2. Jalankan generator source clasp yang sudah dikenal proyek, lalu hanya test relevan yang sudah dikenal untuk source rilis.
3. Bila seluruh perintah lulus, deploy Apps Script memakai `clasp.cmd` ke deployment web app yang ada dan verifikasi versi/URL.
4. Jangan memperbaiki kode, refactor, commit, push, atau menjalankan pemeriksaan tambahan. Bila generator, test, atau deploy gagal, berhenti dan tampilkan error singkat.
5. Laporan akhir hanya: commit rilis, hasil test, versi deployment, URL; atau error pemblokir.

Di luar perintah `finishing`, jangan menjalankan test, commit, push, pull, atau deploy kecuali pengguna memintanya secara eksplisit.

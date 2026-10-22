# Cara kerja

- Baca README saja untuk orientasi; ATURAN/KONTRAK hanya bagian relevan. Jangan baca riwayat atau seluruh repo otomatis.
- Prioritas tampilan yang bisa dilihat pengguna; perubahan kecil, tanpa dependency/refactor spekulatif atau minifikasi sumber.
- Fokus PC; mobile ditunda sampai diminta. Tampilan ringan tanpa animasi/transisi tambahan. FE/BE sesuai tugas pengguna. Jangan commit, push, upload, atau deploy tanpa permintaan pengguna.
- Hemat konteks: rg lalu file/fungsi terkait. Permintaan perbaikan mencakup izin menjalankan tes relevan dan memperbaiki hambatannya. Jangan rebuild peta kode.
- Burst hanya saat diminta, maksimal 3 penulis termasuk Codex bila mengedit; satu file satu pemilik. AI luar tanpa akses GitHub, harus mengirim patch nyata.
- Freebuff maupun Codex boleh menjalankan tes relevan. Codex boleh memperbaiki kegagalan lingkungan, generator, tes, dan deployment dalam lingkup tugas; gunakan bukti tes yang masih sesuai dengan source akhir.
- Selesai satu pekerjaan: lapor hasil lokal, berhenti, tunggu konfirmasi.
- Jika pengguna memberi batch bernomor, tuntaskan seluruh batch berurutan tanpa menunggu konfirmasi per nomor; larangan tes/commit/push/upload/deploy tetap berlaku sampai diminta khusus.
- Izin eksplisit terbaru mengesampingkan default di atas. Jika pengguna menentukan urutan deploy → commit → tes → perbaiki, ikuti urutan itu; hasil koreksi perlu diterbitkan kembali agar deployment sesuai kode akhir.

## Sinkronisasi Chat Codex dan Codex VS Code

Ada dua lingkungan kerja:

- Chat Codex dapat membuat perubahan kode lalu commit dan push ke `origin/main`.
- Codex VS Code bertugas melakukan finishing dan deployment Apps Script.

### Ketika pengguna menulis tepat: `finishing`

Jalankan **Finishing Hemat Token**. Jangan melakukan orientasi ulang, membaca README/riwayat/memory, memakai Graphify/Caveman/Ponytail, audit repository, review diff, atau pencarian luas.

1. Sinkronisasi minimum: abaikan artefak lokal `graphify-out/`, `.ai-inbox/`, `MODE_HEMAT_TOKEN.md`, dan `.clasp-src/`; lalu `git fetch origin` dan fast-forward `main` ke `origin/main`. Pertahankan perubahan lokal; perubahan yang tidak bertabrakan boleh diteruskan. Jangan reset, force-push, atau menimpa pekerjaan pengguna. Bila ada konflik yang memerlukan keputusan pengguna, laporkan blocker.
2. Permintaan `finishing` mengizinkan generator, tes rilis, perbaikan minimal atas kegagalan terkait, commit/push perubahan terkait bila ada, upload source, dan deployment. Jangan membuat commit kosong atau menyertakan perubahan yang tidak terkait.
3. Jalankan generator source clasp yang dikenal dan tes rilis yang relevan. Hasil Freebuff boleh dipakai bila source akhir yang diuji sama; bila bukti belum ada atau source berubah, Codex menjalankan tes sendiri.
4. Bila generator, tes, atau deploy gagal, investigasi dan perbaiki penyebab dalam lingkup finishing, lalu ulangi pemeriksaan yang terdampak. Jangan melewati tes, mengubah kegagalan menjadi skip, atau melakukan refactor spekulatif. Berhenti hanya untuk hambatan akses, keputusan bisnis, atau tindakan destruktif yang memerlukan pengguna.
5. Setelah seluruh pemeriksaan lulus, simpan perubahan terkait ke GitHub bila ada, upload dengan `clasp.cmd`, perbarui deployment web app yang ada, lalu verifikasi versi/URL. Koreksi setelah deployment wajib diterbitkan kembali.
6. Laporan akhir ringkas: commit rilis, hasil tes, versi deployment, URL; atau blocker konkret.

Di luar `finishing`, permintaan perbaikan mengizinkan edit dan tes relevan. Commit, push, pull, dan deploy memerlukan permintaan pengguna. Izin finishing berlaku sampai finishing selesai, termasuk perbaikan hambatan yang ditemukan.

## Kebijakan plugin dan skill

- Figma adalah plugin desain utama. Gunakan untuk rancangan lintas halaman, design system, wireframe, dan review visual sebelum perubahan frontend besar. Source aplikasi tetap berada di GitHub; Figma bukan sumber kode produksi.
- GitHub Actions dan Playwright adalah alat verifikasi utama. Jangan menambah agen atau plugin hanya untuk menggantikan test otomatis yang dapat dijalankan repository.
- Pilih skill sesuai pekerjaan: `investigate-first` untuk diagnosis, `surgical-patch` untuk bug sempit, `lean-build` untuk fitur kecil, `migration` untuk perpindahan data/Drive, `verify-and-stop` untuk bukti akhir, dan `ponytail` untuk menjaga solusi sederhana.
- Gunakan Graphify hanya untuk perubahan lintas banyak modul. Gunakan security scan dan threat model sebelum membuka role/akses multi-pengguna.
- Jangan menambah plugin komunikasi, penyimpanan, atau manajemen kerja tanpa kebutuhan nyata. GitHub tetap menjadi source, backlog, dan riwayat utama.

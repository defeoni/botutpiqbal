# Cara kerja

- Baca README saja untuk orientasi; ATURAN/KONTRAK hanya bagian relevan. Jangan baca riwayat atau seluruh repo otomatis.
- Prioritas tampilan yang bisa dilihat pengguna; perubahan kecil, tanpa dependency/refactor spekulatif atau minifikasi sumber.
- Fokus PC; mobile ditunda sampai diminta. Tampilan ringan tanpa animasi/transisi tambahan. FE/BE sesuai tugas pengguna. Jangan commit, push, upload, atau deploy tanpa permintaan pengguna.
- Hemat konteks: rg lalu file/fungsi terkait. Kerjakan kebutuhan dan logika dulu; jangan jalankan tes apa pun sampai pengguna meminta. Jangan rebuild peta kode.
- Burst hanya saat diminta, maksimal 3 penulis termasuk Codex bila mengedit; satu file satu pemilik. AI luar tanpa akses GitHub, harus mengirim patch nyata.
- Freebuff menjalankan test untuk perubahan yang dibangunnya. Codex Chat hanya menganalisis hasil Freebuff, mengintegrasikan patch yang diterima, lalu commit/push ke GitHub. Codex VS Code menjalankan finishing dan deployment. Jangan menjalankan pemeriksaan ulang yang tidak diperlukan.
- Selesai satu pekerjaan: lapor hasil lokal, berhenti, tunggu konfirmasi.
- Jika pengguna memberi batch bernomor, tuntaskan seluruh batch berurutan tanpa menunggu konfirmasi per nomor; larangan tes/commit/push/upload/deploy tetap berlaku sampai diminta khusus.
- Izin eksplisit terbaru mengesampingkan default di atas. Jika pengguna menentukan urutan deploy → commit → tes → perbaiki, ikuti urutan itu; hasil koreksi perlu diterbitkan kembali agar deployment sesuai kode akhir.

## Sinkronisasi Chat Codex dan Codex VS Code

Ada dua lingkungan kerja:

- Chat Codex dapat membuat perubahan kode lalu commit dan push ke `origin/main`.
- Codex VS Code bertugas melakukan finishing dan deployment Apps Script.

### Ketika pengguna menulis tepat: `finishing`

Jalankan **Finishing Hemat Token**. Jangan melakukan orientasi ulang, membaca README/riwayat/memory, memakai Graphify/Caveman/Ponytail, audit repository, review diff, atau pencarian luas.

1. Sinkronisasi minimum: abaikan artefak lokal `graphify-out/`, `.ai-inbox/`, `MODE_HEMAT_TOKEN.md`, dan `.clasp-src/`; lalu `git fetch origin` dan fast-forward `main` ke `origin/main`. Hanya perubahan terlacak atau file lokal lain yang benar-benar berpotensi tertimpa menjadi blocker.
2. Jalankan generator source clasp yang sudah dikenal proyek. Test relevan dikerjakan oleh Freebuff dalam paket implementasi sebelum finishing; jangan mengulang test di VSCode kecuali pengguna memintanya secara eksplisit.
3. Bila hasil test Freebuff yang relevan sudah tersedia, deploy Apps Script memakai `clasp.cmd` ke deployment web app yang ada dan verifikasi versi/URL. Bila hasil itu belum ada, berhenti dan laporkan bahwa test Freebuff diperlukan.
4. Jangan memperbaiki kode, refactor, commit, push, atau menjalankan pemeriksaan tambahan. Bila generator, test, atau deploy gagal, berhenti dan tampilkan error singkat.
5. Laporan akhir hanya: commit rilis, hasil test Freebuff, versi deployment, URL; atau error pemblokir.

Di luar perintah `finishing`, jangan menjalankan test, commit, push, pull, atau deploy kecuali pengguna memintanya secara eksplisit.

## Kebijakan plugin dan skill

- Figma adalah plugin desain utama. Gunakan untuk rancangan lintas halaman, design system, wireframe, dan review visual sebelum perubahan frontend besar. Source aplikasi tetap berada di GitHub; Figma bukan sumber kode produksi.
- GitHub Actions dan Playwright adalah alat verifikasi utama. Jangan menambah agen atau plugin hanya untuk menggantikan test otomatis yang dapat dijalankan repository.
- Pilih skill sesuai pekerjaan: `investigate-first` untuk diagnosis, `surgical-patch` untuk bug sempit, `lean-build` untuk fitur kecil, `migration` untuk perpindahan data/Drive, `verify-and-stop` untuk bukti akhir, dan `ponytail` untuk menjaga solusi sederhana.
- Gunakan Graphify hanya untuk perubahan lintas banyak modul. Gunakan security scan dan threat model sebelum membuka role/akses multi-pengguna.
- Jangan menambah plugin komunikasi, penyimpanan, atau manajemen kerja tanpa kebutuhan nyata. GitHub tetap menjadi source, backlog, dan riwayat utama.

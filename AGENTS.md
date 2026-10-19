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

- Perintah “finishing”: tes → perbaiki semua kegagalan → commit → deploy. Tidak termasuk push GitHub kecuali diminta.

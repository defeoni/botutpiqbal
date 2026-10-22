# Telegram: keputusan dan implementasi

Telegram menjadi panel monitoring admin dengan tombol. Pesan teks apa pun membuka beranda tanpa memerlukan /start. Chat privat dan identitas pemilik tetap diperiksa sebelum panel/media diproses.

- Proyek teratas; awalnya Semua Proyek. Menu Deadline, Follow-up, Inbox, Buka web.
- Deadline memakai tanggal tracking Kanban, sampai H-3 termasuk terlambat. Selesai/ditolak disisihkan.
- Follow-up mencakup tracking diajukan/diproses/revisi dan pengiriman yang dikonfirmasi admin. Tidak menyatakan penerima sudah membaca. Jawaban masuk perlu dilengkapi di web.
- Draf WA PM/MK/HO dibuat dari judul/proyek; pengguna menyalin dan mengirim sendiri. Konfirmasi pengiriman dicatat dengan waktu dan histori pada telegramDocumentFollowups, terlihat pada detail web.
- Status yang dapat diubah adalah tracking administrasi. Approval, keputusan material, pembayaran dan penerimaan bisnis tetap melalui formulir sumber di web.
- Detail memakai tautan proyek/dokumen; login tetap wajib. Menu Telegram diedit pada pesan yang sama; konteks menu bertahan maksimal enam jam dan boleh kedaluwarsa. Catatan follow-up tersimpan permanen.
- Alarm singkat Senin–Jumat pada jam 08/13/16 WIB. Trigger per jam dipasang saat panel pertama kali digunakan. Apps Script dapat menjadwalkan menit yang bervariasi dalam jam tersebut; tidak menjamin tepat menit 00. Slot dikunci dan dicatat setelah pengiriman API berhasil.
- Media: proyek dan tujuan Nota/Arsip dipilih manual. Tidak ada OCR untuk menentukan tujuan. Metadata serta pengolahan diteruskan di web.

Belum termasuk: OCR sesudah memilih Keuangan, deteksi duplikasi berdasarkan isi berkas, keluarga/penomoran dokumen klarifikasi formal, dan pengujian bot/Drive produksi. Jangan menganggap perubahan lokal sudah terdeploy.

Implementasi: aplikasi/TelegramPanel.gs, handler Memo.gs, tautan detail DocumentCenterClient.html, riwayat follow-up Projects.gs; generator clasp menyertakan file panel.

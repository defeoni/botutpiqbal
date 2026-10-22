# Serahan workspace dan monitoring dokumen

Basis GitHub: 251f911. Scope pengguna adalah monitoring pergerakan dan meja kerja proyek, termasuk katalog owner yang bisa dipakai ulang. Deployment Apps Script tetap melalui finishing VSCode. Setiap perubahan kode selesai dipush ke GitHub sesuai instruksi tetap pengguna.

Perilaku:
- Dokumen Aktif adalah Kanban default; status tracking SELESAI dipisahkan ke Arsip. Template/Form/Contoh tidak menjadi kartu proses sebelum dipakai.
- Filter asal Semua/PT UTP/Owner. Standar PT UTP tetap tersedia setiap proyek; katalog owner hanya dimuat pada satu proyek aktif, bukan Semua Proyek. Transaksi tidak bercampur.
- Unggah banyak template owner (5 MB per file), klasifikasi kluster/kelompok/sistem/frekuensi manual. Semua berkas dapat dipakai ulang sebagai salinan, bukan menimpa asli. Tidak ada generasi kartu rutin otomatis.
- Satu kartu per dokumen; berkas kerja, revisi, bukti, balasan, hasil ekspor dan scan final dilihat dari detail yang sama. File asli dan versi sebelumnya tetap disimpan. Salinan draf yang ditautkan ke sumber mengikuti identitas sumber; tautan lama draf tetap dapat membuka kartu sumber.
- Form detail mencatat nomor, tanggal, jenis, periode, penerima, tindakan, tanggal disampaikan, deadline, follow-up dan riwayat. Tracking terpisah dari keputusan bisnis sumber. SELESAI administratif bukan bukti approval/pembayaran otomatis.
- Telegram memakai metadata dan tanggal follow-up tersebut; draf WA menyertakan nomor serta tindakan yang diminta. Pengiriman WA tetap manual.

Penyimpanan/API: Projects.gs memperluas apiProjectDocument dan menambahkan apiDocumentWorkspace. ownerDocumentTemplates adalah katalog owner; workspaceDocumentFiles adalah referensi versi/lampiran per dokumen. apiProjects(documents) mengembalikan katalog owner untuk proyek aktif dan menggabungkan data monitoring. Semua endpoint memerlukan sesi owner, mutasi memakai lock dan pengecekan proyek/versi. Retry unggahan memakai requestId stabil. Format XLS legacy kini diterima oleh uploader bersama.

Belum aktif: klasifikasi otomatis AI. Tidak ada OpenAI API/key yang dibuat atau dipakai. UI manual tetap dapat dipakai penuh. Generator dokumen baru selain yang sudah ada tidak ditambahkan; template Word/Excel/PDF dapat disalin dan diisi manual.

Bukti: pengujian unit dokumen mencakup isolasi, retry, salinan asli, konflik versi, metadata, lampiran satu kartu, ekspor tergabung dan autentikasi. alat/periksa-dokumen-owner.cjs menjalankan UI + handler nyata dengan layanan Google simulasi: unggah → gunakan template → isi monitoring → unggah scan → selesai/arsip → pindah proyek. Konversi/Drive/Telegram produksi tetap memerlukan verifikasi saat finishing VSCode. Tidak ada mutasi Drive produksi pada pekerjaan Cloud ini.

Hasil akhir: 226 tes lulus, nol gagal/skip; browser owner dokumen, LPD, serta layout padat 12 halaman/tiga ukuran desktop lulus. Generator clasp menghasilkan 43 file, diff check bersih.

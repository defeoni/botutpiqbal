# Aturan produk

Admin PT.UTP; satu admin, proyek Terrasentra Bandung, PM Juhana, TRSM-51D26-D-M. Baca bagian terkait saja.

## Material — keputusan final

Alur lapangan menulis permintaan → admin input → PM → MK → HO sesuai batas persetujuan yang admin pilih. Satu jalur dapat menghasilkan approval material dan permintaan ke HO. Tidak semua item memerlukan seluruh jalur.

- Klasifikasi PER ITEM: bermerek; generik terkonfirmasi; merek belum diketahui; By Owner/By Other. Permintaan boleh campuran.
- Bermerek harus cocok merek/tipe approval. Generik tetap membutuhkan approval generik. Merek kosong/belum diketahui bukan generik.
- By Owner/By Other tidak membutuhkan approval, brosur, atau final HO; surat permintaan bila diperlukan. Jangan otomatis menandainya barang sudah siap/datang.
- Admin menetapkan persetujuan diperlukan PM/MK/HO. Tampilkan siapa yang benar-benar menyetujui. Jalur HO membutuhkan PDF/scan final HO; PM/MK tidak otomatis wajib final HO.
- Persetujuan sebagian boleh lanjut; ditolak/ditunda tetap dalam riwayat dan tidak masuk daftar final.
- Dokumen bisnis tetap satu. REV naik hanya ketika admin menekan **Terbitkan Revisi** atas instruksi PM/MK/HO dengan pihak dan alasan. Koreksi ketik biasa tidak menaikkan REV, tetap tercatat sebagai perubahan.
- Review: pilih item dari pencarian/dropdown daftar awal, dapat tambah item. Simpan sebelum/sesudah per field, pihak, waktu, catatan. Pisahkan status keputusan, perubahan data, dan peringatan risiko.
- Permintaan awal dan final adalah keluaran resmi; review antara keduanya catatan pribadi sistem. Upload final HO untuk pemberkasan, jangan menuntut input ulang scan.
- HO dapat mengubah merek/spesifikasi tanpa kembali ke MK. Kekurangan bisa diajukan pada permintaan berikutnya dari nol, dibantu riwayat penolakan.
- Di luar approval boleh dipilih dengan alasan pengecualian tersimpan di web. Baris merah PLUS teks risiko; tulisan terkait pada approval merah. Pengecualian bukan otomatis approval global.
- Nomor dokumen resmi belum ditetapkan; jangan mengunci format contoh. REV 001 → REV 002 adalah contoh pola revisi.
- Barang Datang hanya konfirmasi kedatangan dari admin gudang/pengamatan admin. Tidak ada jumlah penerimaan, parsial, rusak, kelengkapan. Jangan menyamakannya dengan pemeriksaan kuantitas lengkap atau otomatis menutup semua pekerjaan.
- Brosur PDF/Word, satu material satu approval, biasanya satu merek fix namun beberapa merek dapat diizinkan. Hasil tes/contoh material bukan tugas admin.
- Kolom F contoh approval menunjukkan usulan/fix konteks perusahaan: kosong masih compare/belum approval HO; Compare dipertimbangkan; Owner/Other dari owner. Jangan otomatis menganggap isi F sebagai bukti persetujuan. Catat otoritas manual sesuai dokumen.

## Master item dan pencarian

- Master resmi untuk identitas/spesifikasi, BUKAN stok proyek aktual. Excel contoh lainnya hanya referensi template; master item adalah data asli.
- Master 28.473 kode unik (disebut 28–30 ribu saat diskusi); 96 kode nol awal. Jangan hilangkan nol awal atau ubah nama asli.
- Hasil parser saat diselesaikan: 14.029 merek eksplisit, 4.881 kandidat, 9.563 belum diketahui, 183 merek terstruktur. Bukan bukti semua kandidat benar.
- Merek sering setelah koma, berulang, huruf besar; ambil merek sebelum `|` atau `#`, model berikutnya bukan merek. BOSCH contoh penjelasan, bukan bukti merek itu ada di master.
- Jangan menyimpulkan generik hanya karena tidak ada merek. Konflik hasil ekstraksi menunggu konfirmasi admin.
- Cari kode/nama/merek/tipe/kelompok; approved lebih dahulu lalu favorit. Alias untuk pencarian, tidak mengubah data resmi.
- Jangan memuat seluruh master ke dropdown. Gunakan pencarian terbatas/asinkron, kode pendek tetap bisa ditemukan; jangan mewajibkan tiga karakter untuk semua kode.
- HO mungkin mengirim pembaruan penuh atau perubahan; preview dan upsert, jangan menghapus item lama hanya karena tidak tercantum. Identitas spesifikasi sebagai acuan masih akan dikonfirmasi pengguna.
- Item sementara boleh untuk barang belum ada, kemudian dipetakan ke identitas resmi sambil mempertahankan riwayat.

## Keuangan, SDM dan fitur berikutnya

- RPB = Rencana Pengeluaran Bulanan, RPD = Rencana Pengeluaran Dana, LPD = Laporan Penggunaan Dana. Ketiganya bukan pembelian material.
- Admin memegang semua dana, pembayaran langsung vendor atau dalam kasus tertentu PM (urgent/kontrakan).
- RPB pengajuan maksimum tanggal 25; pembayaran bertahap M1–M2 dan M3–M4; terkait LPD sebelumnya. Template perusahaan dipertahankan.
- RPD memakai invoice/kwitansi dan detail penerima; ingatkan H-2 kebutuhan. Pengajuan/ttd/finance sesuai alur perusahaan, bukan approval bot.
- LPD wajib nota; kelebihan dikembalikan. Nota pudar perlu fotokopi. Batas kalender: Bandung 3 hari setelah transfer, Jabodetabek/Garut/Cianjur/Jawa 7, luar Jawa 10. Detail implementasi perlu mengikuti template.
- Admin sendiri foto nota via Telegram. Simpan asli, OCR sebagai draf, tanggal transaksi vs unggah, kategori/kaitan dana, deteksi duplikasi dan verifikasi admin sebelum pembukuan.
- Kontrakan/mess: pengajuan, perjanjian, bukti DP, dua rangkap materai, scan dan pengiriman hardcopy. SDM: penambahan/penggantian/kepulangan OS, KTP, plotting/schedule, kasbon dengan syarat fingerprint/lokasi. Surat/berita acara dan absensi menyusul.
- Absensi belum ada format lapangan/SDM; wadah saja, teknis ditunda. Bukan prioritas sekarang.
- Grafik dua mingguan opsional: sering dipesan/galon/tren pemesanan dan perkiraan minggu depan. Gunakan riwayat pemesanan, jangan mengklaim konsumsi atau stok. Data kurang diberi keterangan; tanpa pembelian otomatis. Tidak perlu agen AI permanen untuk hitungan rutin.

## Telegram, email, keamanan

- Admin saja dua arah. Tidak ada persetujuan PM/MK/HO melalui bot. WhatsApp tidak digunakan.
- Pengingat Senin–Jumat 08.00, 13.00, 16.00 WIB; Sabtu/Minggu tidak. Tanggal merah tetap dikirim. Tugas belum selesai tetap muncul pada jadwal semula.
- Tombol selesai per tugas, bukan semua sekaligus. Bukti opsional, dapat dikirim via Telegram/web. Bisa input tugas sederhana manual di Telegram. Tanpa tugas tanyakan “Tidak ada tugas atau kelupaan?”.
- Bedakan dijadwalkan, gagal, diterima API; tidak menyatakan pengguna sudah membaca pesan.
- Email hanya DRAF, admin kirim manual. TO project.engineering@unicorn.co.id; CC Yuni.lestari@unicorn.co.id. Tidak otomatis membaca balasan atau mengirim.
- PIN untuk tindakan krusial terutama hapus, final/tracking/ubah terlindungi; input draf berjalan tidak selalu perlu PIN. Soft delete/audit/reopen sesuai tindakan.
- Gagal/konflik simpan harus mempertahankan isian, coba lagi/bandingkan versi sebelum mengganti. Jangan diam-diam menimpa.
- Gmail/Drive pribadi kapasitas sekitar 300GB, perusahaan mengizinkan. Ini bukan konfirmasi kapasitas/akses OAuth saat ini.

## UI yang disepakati

Beranda sidebar: Beranda, Katalog Material, Persetujuan Material, Permintaan & Review, Barang Datang, Memo, RPB. Modul belum tersedia diberi label nonaktif, akses lama RPD dipertahankan. Ringkasan: Menunggu Input Review, Perlu Unggah Final HO, Menunggu Barang. Header proyek/PM/tanggal dinamis. Daftar terbaru, tugas, log Telegram. Data ilustrasi harus jelas, fitur belum terhubung jangan berpura-pura aktif.

Putih/abu #F9FAFB dengan teal untuk utama/aktif. Ponsel menu lipat, kartu dua kolom, tabel geser. Risiko teks dan merah terpisah dari status. Istilah **Input Hasil Review**, bukan tindakan yang otomatis menaikkan REV. Kolom persetujuan diperlukan tidak mencampur By Owner sebagai otoritas.

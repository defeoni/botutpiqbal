# Admin PT.UTP — lanjut dari komputer lain

> **Struktur terbaru 17 Oktober 2026:** kode aktif di `aplikasi/`, alat di `alat/`, tes di `pengujian/`, tampilan contoh di `pratinjau/`. Baca `STRUKTUR-FOLDER.md` untuk menerjemahkan lokasi lama. `STATUS-BREAK.md` adalah checkpoint terakhir yang mengungguli angka/progres historis di bawah.

> **UPDATE CHECKPOINT BREAK 17 Oktober 2026:** Baca `STATUS-BREAK.md` setelah gambaran di sini. Penataan folder selesai, build berhasil, backend/RPB 45/45 dan prototipe mandiri 17/17 lulus. Pemeriksaan frontend terintegrasi berhenti pada overflow Katalog ponsel 390px; frontend belum dinyatakan selesai. Catatan lama enam kegagalan storage sudah diperbaiki. Mode burst tidak otomatis berlaku pada chat baru.

Checkpoint 16 Oktober 2026, WIB. Ini catatan keputusan dan progres untuk AI/pengguna di perangkat baru. Riwayat asli yang tersedia diekspor ke `riwayat/`; catatan ini bukan klaim seluruh lampiran dan semua chat lain telah tersalin.

## Cara melanjutkan

1. Gunakan repository `https://github.com/defeoni/botutpiqbal` sebagai sumber kode dan konteks.
2. Untuk tanpa folder lokal, buka tugas Codex Cloud yang terhubung repository ini. Tugas yang sudah ada bernama **Set up botutpiqbal**. Periksa versi checkout terlebih dahulu; tugas Cloud lama tidak otomatis mengambil commit baru.
3. Minta AI membaca AGENTS.md, dokumen ini, dan laporan `laporan/`. Riwayat panjang hanya dibaca saat perlu keputusan spesifik; jangan memuat semuanya untuk tiap tugas.
4. Alternatif lokal: clone/download repository di rumah dan buka foldernya. Chat lama tidak otomatis muncul hanya karena folder dipindahkan; AI baru dapat melanjutkan dari dokumen.
5. Master asli dan lampiran privat tidak otomatis tersedia melalui Git. Lihat bagian data privat di bawah. Jangan mengarang akses file kantor.

Prompt untuk AI baru:

```text
Lanjutkan proyek Admin PT.UTP dari repository ini. Baca AGENTS.md, panduan/MULAI-DI-SINI.md dan panduan/laporan/. Jelaskan singkat versi kode, pekerjaan selesai, batasan, dan tugas berikutnya. Jangan langsung deploy, push Apps Script, atau mengubah hosting. Pertahankan perubahan yang sudah ada. Baca riwayat hanya bila keputusan spesifik belum jelas. Gunakan bahasa Indonesia sederhana. Hemat konteks, bagi pekerjaan menjadi dua tugas terkait dengan batas file yang jelas. Jangan klaim semua tes/cloud berhasil berdasarkan laporan lokal saja. Tunggu arahan pekerjaan setelah orientasi.
```

## Tujuan dan cara kerja pengguna

- Aplikasi administrasi kontraktor, bukan hanya memo. Pengguna adalah satu admin dengan seluruh hak edit; hanya satu proyek aktif.
- Proyek Terrasentra, Bandung; PM Juhana; kode TRSM-51D26-D-M.
- Web pusat pekerjaan. Telegram untuk pengingat, ringkasan, tautan, tugas sederhana, foto nota dan konfirmasi oleh admin saja.
- PM/MK/HO tidak login; review dilakukan luring/kertas/chat dan admin menginput instruksinya.
- UI menarik, ringan, mudah dipahami, desktop dan ponsel. Pengguna nonprogrammer; prompt/kode yang perlu disalin harus dalam code block lengkap.
- Pengguna memilih rekomendasi rutin terbaik tanpa banyak pertanyaan berulang. Tanyakan hanya ketidakjelasan penting yang belum diputuskan.
- Saat ini orientasi dan penyimpanan konteks lintas perangkat. Jangan menganggap perpindahan cloud mengizinkan deployment produksi.

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

Rancangan Gemini Katalog/Form sudah diterima untuk ditinjau, BELUM kode. Perlu koreksi: larangan kode pendek tiga karakter, mencampur input awal/review, risiko sebagai status, By Owner otomatis siap. Pertanyaan yang telah dijawab jangan diulang. Status approval berubah sebaiknya ditinjau ulang dengan peringatan tanpa menghapus snapshot, tetapi belum diimplementasikan.

## Progres kode dan bukti

- Commit sebelum paket ini: d1330d9 di main, 27 file. Itu checkpoint, bukan rilis teruji produksi.
- Memo/RPB implementasi existing, RPD placeholder. Entry aktif `aplikasi/memo/Memo.gs` doGet → template aplikasi/bersama/Index.html. Root Code.gs legacy tidak masuk build aktif.
- Copilot RPB selesai lokal: race draf, PIN tracking, kategori, overflow total, LPD bulan sebelumnya, cleanup error, panel sukses lama. Laporan lokal tes 7/7. Ekspor/Drive/klasifikasi nonmaterial cloud belum diperiksa.
- Copilot Beranda/login selesai lokal: apiCreateSession({password}), Auth.gs masuk build, reset counter mengirim PIN; Beranda awal, navigasi Memo/RPB/RPD, gaya responsif, tanggal, data contoh. Build 12 file; tes RPB7/7; desktop1440x900/ponsel390x844 dilaporkan diperiksa. Login preview hanya pesan gagal tanpa panggilan backend. Ini BUKAN bukti login/PIN cloud berhasil.
- Partial baru `aplikasi/bersama/HomeView.html`; build `alat/buat-sumber-clasp.js`; preview `alat/buat-pratinjau.py` → pratinjau/aplikasi.html.
- `aplikasi/material/UtpDomain.gs` validator/history/revisi/approval/CSV/forecast; laporan tes domain22/22. `aplikasi/material/Utp.gs` adapter draft masih enam kegagalan storage dari12; BELUM diintegrasikan ke build/dashboard. UtpStyles/UtpView fondasi, belum UtpClient.
- `aplikasi/bersama/Auth.gs` password panjang24+, PIN6digit hash/salt, throttle3 percobaan/15m, cache sesi6jam. Konfigurasi private editor helper; jangan mengarang password produksi. Autentikasi cloud belum teruji.
- Graph struktur `graphify-out/code-graph.json`, SOURCE_MAP.md; awal498node/1216edge/14eksternal, bisa basi setelah edit. `alat/peta-kode.py` query hemat, ekstraksi struktural tanpa LLM.
- `alat/siapkan-master-item.py` converter source-preserving; laporan self-test14 parser+3 kode, deterministic dan sumber tidak berubah.
- Tidak ada deployment Apps Script pada kerja ini; identitas target/daftar cloud belum dibandingkan sukses. .clasp.json existing target tidak membuktikan cloud cocok.

## Pekerjaan berikutnya, jangan dilewatkan

1. Tinjau diff Copilot login/Beranda secara terarah sebelum coding material; pertahankan Memo/RPB. Jangan hanya mempercayai laporan sebagai runtime cloud.
2. Koreksi rancangan Katalog/Form; tetapkan kontrak data dan batas file sebelum memberi dua AI tugas bersamaan.
3. Perbaiki adapter Utp: import parser `{headers,rows}` vs shift (2 tes); folder upload privat (1); final HO tidak boleh hilang ketika edit FINAL/ARRIVED (1); action settings PIN/allowlist (1); audit >50k sebelum commit agar gagal konsisten (1). Refresh konteks validasi di dalam lock.
4. Integrasi material bertahap; jangan mengaktifkan semua backend unfinished sekaligus.
5. Sebelum clasp push: verifikasi identitas project, snapshot/daftar file cloud vs build, akses pemilik, rollback, baru deployment berwenang. Jangan menimpa cloud dengan asumsi build lokal sama.
6. Hosting belum diputuskan. Apps Script existing dipertahankan sambil menilai kebutuhan. Cloud Codex lingkungan pengembangan, bukan hosting aplikasi admin produksi. Klaim hosting gratis/kuota dari AI eksternal harus diverifikasi resmi.

## Workflow AI dan hemat token

Codex kapten/integrasi, Copilot penulis lokal, Gemini desain/riset, ChatGPT web riset, Qwen kode/tes terbatas, Claude review, AIStudio komponen bila kontrak jelas. Tidak perlu semua aktif bersamaan. Maksimal dua penulis dengan file tidak beririsan dan reviewer bila perlu. Dua pekerjaan terkait per prompt, keluaran lengkap, laporan ringkas, tanpa refactor liar/dependency baru.

Graphify untuk struktur/dampak, Caveman untuk investigasi/implementasi kecil, Ponytail solusi minimal. Baca skill tersedia; jangan klaim plugin cloud login/aktif hanya karena terpasang lokal. Skill lokal tidak otomatis pindah ke Cloud. Jangan mengirim master28k atau seluruh riwayat ke setiap agen. Riset model/limit belum diverifikasi permanen, nama model berubah. Penggunaan AI luar punya kuota sendiri, jangan janjikan unlimited/gratis.

Pengguna mengizinkan koordinasi tugas Copilot; tetap jangan mengirim pesan ke orang lain tanpa izin. Pengambilalihan komputer memerlukan konfirmasi pengguna. Instruksi baru dan AGENTS.md yang berlaku mengatur scope.

## Data privat dan kelengkapan backup

- `.local/master/master_items.csv`, laporan `.local/copilot/`, staging `.clasp-src/`, rahasia `.env` diabaikan Git. Salinan laporan dipublikasikan di panduan/laporan setelah pemeriksaan.
- Master asli: `C:/Users/User/Downloads/PT.UTP - Master Item.xlsx`. Contoh: Form Approval Material Terrasentra 12082026.xlsx, 012. Reques Material JO Santo Yusup.xlsx, Master tools Pengiriman Ke-13.xlsx, SPESIFIKASI ME TERRASENTRA MALL .xlsx. Berada Downloads kantor; belum otomatis tercakup di Git.
- Lampiran chat berada `.codex/attachments/`; gambar temporer bisa hilang. Ekspor pesan mencatat referensinya tetapi bukan backup file tersebut. Untuk pekerjaan template/master di rumah, pindahkan asli via penyimpanan privat yang Anda kuasai; jangan unggah data asli ke Git tanpa keputusan khusus.
- Ekspor riwayat tidak membuat chat lokal dapat diimpor otomatis ke sidebar. AI baru membaca file untuk melanjutkan. Percakapan lama dapat berisi keputusan yang kemudian dibatalkan; gunakan keputusan terbaru di sini.
- Persentase progres sebelumnya10–15% perkiraan tanpa pengukuran, jangan digunakan. Ukur melalui modul/tes/batasan.

# Review skenario Gemini — 18 Oktober 2026

Status: rancangan uji yang ditinjau terhadap kode lokal, BELUM hasil eksekusi. Sumber: delapan skenario yang dikirim pengguna dari Gemini. Tidak semua asumsi Gemini menjadi kebutuhan baru.

| ID | Skenario setelah koreksi | Bukti yang perlu diperiksa |
|---|---|---|
| ADV-01 | Dua item jalur HO memakai satu metadata bukti yang mencakup keduanya; seluruh keputusan pihak dan syarat approval/pengecualian dipenuhi. | Keduanya layak final; coveredItemIds dan finalFileId benar. Preview hanya metadata, bukan unggah nyata. |
| ADV-02 | Bukti mencakup A/B, tidak C. C tidak boleh memilih bukti tersebut atau lolos kelayakan final dengannya. | C tidak masuk final. Keputusan HO manual tetap dapat dicatat; bukti tidak boleh memalsukan atau menghapus keputusan pihak. |
| ADV-03 | A memenuhi seluruh jalur wajib; B ditolak; C ditunda. Tetapkan final dengan pihak/alasan. | Hanya A pada daftar final; semua item dan riwayat tetap ada. Approved MK saja belum cukup bila PM belum disetujui. |
| ADV-04 | Owner/Other tidak memerlukan approval/HO. Uji sebelum dan sesudah konfirmasi penyediaan. | Tidak otomatis tersedia/datang. Konfirmasi Barang Datang saat ini per dokumen; kedatangan per item adalah kebutuhan terpisah, bukan klaim fitur existing. |
| ADV-05 | Simpan perubahan review, lalu terbitkan revisi dengan pihak/alasan. | REV 001 -> 002; snapshot awal dan revisi lama tetap utuh. Koreksi biasa tidak menaikkan REV. |
| ADV-06 | Simulasikan gagal simpan saat submit/finalisasi; coba lagi. | Isian tetap ada, status/snapshot tidak berubah seolah berhasil. Gunakan failNext pada preview; jangan klaim HTTP 500/cloud telah diuji. |
| ADV-07 | Versi sesi lain berubah sebelum Terbitkan Revisi. | Tidak overwrite; konflik tampil dan isian/pihak/alasan tidak hilang. Hasil pilihan perlu disimpan dan direvisi secara eksplisit. |
| ADV-08 | Hasil server merek kosong/null dipakai sebagai sumber item. | UNKNOWN dan keputusan PENDING; tidak otomatis generik/approved. UNKNOWN boleh dicatat sebagai draf; kelayakan final perlu klasifikasi/approval atau alasan pengecualian sesuai kontrak. Mutasi live tetap nonaktif. |

Prioritas implementasi tes: ADV-01/02/03, kemudian ADV-06/07/05. ADV-04/08 perlu membedakan kontrak yang tersedia dari kebutuhan tambahan. Tidak ada perubahan kode produk dalam review ini.

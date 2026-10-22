# Template tetap LPD

`TEMPLATE-LPD-PT-UTP.xlsx` adalah template kosong dari contoh perusahaan. Logo, format, kop, dan rumus dipertahankan; transaksi, identitas pengisi, dan tanda tangan contoh dihapus. Jangan menimpa file ini dengan hasil laporan.

Lokasi Drive tujuan: `SISTEM PT.UTP/00_TEMPLATE ASLI/LPD/`.
Generator memakai salinan baru dan membaca ID template Drive dari Script Property `LPD_TEMPLATE_FILE_ID`. Setup di web: LPD → Generator laporan dan arsip tanda tangan → unggah file kosong ini → Pasang template LPD (PIN). SHA-256 template diperiksa sebelum disimpan. Konfigurasi Drive belum dijalankan dari Cloud ini.

Generator `LpdDocuments.gs` mengisi template, membuat satu Google Spreadsheet (lembar tambahan jika >27 nota), dan PDF tanpa foto nota. Ukuran kertas A4/A3/Letter/Legal dipilih di web. Hasil konversi/cetak harus diverifikasi di runtime Google sebelum dinyatakan siap produksi. Jika PDF gagal, Spreadsheet tetap tercatat; retry memakai Spreadsheet yang sama. Scan bertanda tangan dikaitkan dengan ID ekspor dan versi sumber, tidak menimpa versi sebelumnya.

Hasil laporan: `SISTEM PT.UTP/01_PROYEK/[KODE] - [Nama]/03_LPD/`.
Bukti transaksi: subfolder `Nota dan Bukti` dalam folder LPD proyek.

Keberadaan layanan `SistemDrive.gs` tidak membuktikan konsolidasi Drive nyata sudah dijalankan. Gunakan status/plan layanan tersebut untuk mengetahui kondisi sebenarnya sebelum apply.

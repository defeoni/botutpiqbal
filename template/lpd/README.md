# Template tetap LPD

`TEMPLATE-LPD-PT-UTP.xlsx` adalah template kosong dari contoh perusahaan. Logo, format, kop, dan rumus dipertahankan; transaksi, identitas pengisi, dan tanda tangan contoh dihapus. Jangan menimpa file ini dengan hasil laporan.

Lokasi Drive tujuan: `SISTEM PT.UTP/00_TEMPLATE ASLI/LPD/`.
Generator harus memakai salinan baru dan membaca ID template Drive dari Script Property `LPD_TEMPLATE_FILE_ID`. Properti tersebut belum dikonfigurasi dari sesi ini; generator LPD masih menunggu patch Freebuff yang diterima.

Hasil laporan: `SISTEM PT.UTP/01_PROYEK/[KODE] - [Nama]/03_LPD/`.
Bukti transaksi: subfolder `Nota dan Bukti` dalam folder LPD proyek.

Keberadaan layanan `SistemDrive.gs` tidak membuktikan konsolidasi Drive nyata sudah dijalankan. Gunakan status/plan layanan tersebut untuk mengetahui kondisi sebenarnya sebelum apply.

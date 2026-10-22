# Serahan LPD — implementasi lokal

Basis main c7b473b. Perubahan Telegram dan LPD dipublikasikan bersama ke GitHub atas instruksi pengguna setelah pemeriksaan lokal. Deployment Apps Script dan mutasi Drive produksi belum dilakukan; lihat riwayat Git untuk commit publikasi.

Keputusan pengguna:
- Nota diterima dari Telegram atau web Nota & Keuangan; unggahan dari LPD masuk catatan nota yang sama.
- Satu nota utuh hanya satu LPD. Deskripsi dapat diedit; tidak membagi nominal ke laporan lain.
- LPD khusus RPD diperbolehkan, beberapa LPD dalam periode sama dengan sumber berbeda. Tranche RPB tetap tidak dihitung berulang.
- Deadline manual, tentatif, dapat diganti/dikosongkan; tenggat lama tetap dipertahankan sebagai histori.
- Generator hanya laporan Spreadsheet/PDF. Foto nota dapat diunduh atau dibuka pada Spreadsheet foto terpisah untuk penataan manual.
- Scan tanda tangan basah menjadi arsip final yang menunjuk versi ekspor; dokumen sebelumnya tetap disimpan.
- OCR Google Drive, tanpa AI/key baru; teks menjadi draf catatan untuk diedit. Tidak membaca nominal/tanggal otomatis, tidak menentukan tujuan unggahan.

Implementasi: `LpdDocuments.gs`, perubahan `LPD.gs`/client/view, Workspace/ProjectTools, index dokumen dan Telegram. Retry create draf memakai clientRequestId persisten, penggunaan nota diturunkan dari LPD yang berhasil tersimpan. API `apiLpd`: notaList, artifacts, templateStatus, templateUpload, export, signedUpload; `apiWorkspace` finance: ocr, photoSheet.

Setup finishing VSCode:
1. Generator clasp sekarang menyertakan LpdDocuments.gs dan TelegramPanel.gs (43 file).
2. Deploy ke deployment yang sudah ada sesuai otorisasi finishing pengguna.
3. Pilih proyek, buka LPD dan pasang template kosong `template/lpd/TEMPLATE-LPD-PT-UTP.xlsx` lewat kontrol setup/PIN. SHA-256 diperiksa sebelum membuat file template; property LPD_TEMPLATE_FILE_ID diisi aplikasi. File contoh Januari tidak digunakan sebagai template generator.
4. Pastikan Google Drive API pada project Apps Script dapat menerima konversi multipart ke Sheets/Docs (scope Drive/Sheets/Documents sudah di manifest). Uji OCR JPG/PNG/PDF, generator, logo, tanggal, wrap, pemisahan lembar, cetak ukuran kertas, dan scan arsip dengan data uji yang disepakati.

Keterbatasan nyata: tes lokal memakai layanan Google in-memory, tidak membuktikan layout PDF atau OCR runtime. Gambar Spreadsheet dibatasi format JPG/PNG dan 2 MB per gambar oleh insertImage; berkas lain tetap dapat diunduh, aplikasi memberi warning. OCR membaca lampiran pertama secara default. Jika banyak foto dalam satu nota, hasil lain belum otomatis digabung. PDF yang gagal tidak menghapus Spreadsheet; ekspor ulang mencoba PDF kembali. Pengarsipan scan tidak otomatis menyatakan pihak tertentu telah menandatangani atau melunasi kewajiban keuangan.

Bukti: suite 220 tes lulus, 0 gagal/skip. Pemeriksaan browser LPD (inbox → LPD khusus RPD → deadline manual → label/lock nota), Workspace (buat/edit/navigasi/RPD), dan layout padat (12 halaman, tiga ukuran desktop, font minimal 10px) lulus. Generator clasp menghasilkan 43 file. Tes generator layanan mock mencakup overflow 28 nota menjadi dua lembar, PDF gagal lalu retry memakai Spreadsheet sama, dan snapshot scan per versi tanpa duplikasi.

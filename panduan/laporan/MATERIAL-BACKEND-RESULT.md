# Hasil Perbaikan Backend Material Admin PT.UTP

## Temuan aktual sebelum perbaikan

- Tes baseline domain/storage: 34 tes; 28 lulus dan 6 gagal.
- `importCommit` memperlakukan hasil `utpParseCsv_` sebagai array, padahal parser mengembalikan `{headers, rows}`. Akibatnya impor master dan validasi impor gagal sebelum alur upsert selesai.
- Upload baru dibuat sebagai anak folder arsip; saat akar arsip memiliki akses publik, file turunan ikut publik.
- Simpan ulang FINAL/ARRIVED dapat mengosongkan `finalFileId` meskipun PIN benar. Validasi save juga hanya mengecek pendaftaran file, bukan tipe file final yang diizinkan.
- Aksi `settings` belum tersedia sehingga gagal sebagai tindakan tidak didukung, bukan memeriksa PIN atau menyimpan pengaturan.
- Audit menyimpan snapshot sebelum dan sesudah secara penuh. Untuk rekaman besar, sel audit melampaui batas Sheets setelah rekaman utama ditulis.
- Konteks validasi mutasi dibaca sebelum lock diperoleh, sehingga dapat tertinggal dari perubahan yang terjadi selama menunggu lock.

## Perubahan dan file terkait

- `utp/Utp.gs`: impor memakai `plan.items` hasil parse/validasi; upsert mempertahankan kode dan nama asli, bidang yang tidak dikirim, serta item yang tidak tercantum. Konteks validasi mutasi kini dibaca setelah lock.
- `utp/Utp.gs`: upload memakai folder mandiri privat. Folder lama tidak diubah atau digunakan ulang tanpa penanda privat; bukti final harus berupa file terdaftar PDF/JPG/PNG dan bukti HO pada FINAL/ARRIVED tidak dapat dihapus lewat edit. Aksi settings memerlukan PIN, hanya menerima allowlist `favorites`, dan menyimpan melalui Sheets.
- `utp/Utp.gs`: audit mencatat delta tanpa menduplikasi `history`, menguji ukuran sebelum menulis, dan menyatakan eksplisit bila rekaman tersimpan tetapi penulisan audit gagal. Upload tidak membuang file yang sudah tercatat akibat kegagalan audit.
- `utp/UtpDomain.gs`: kewajiban bukti final didasarkan pada jalur HO yang benar-benar ditempuh dan tetap berlaku pada Barang Datang; tidak diturunkan hanya dari `requiredAuthority`.
- `tests/utp-storage.test.js` dan `tests/utp-domain.test.js`: perlindungan untuk import, lock, upload privat, file final terdaftar dan bertipe benar, alur OWNER/PM/HO, settings, serta konsistensi audit.
- Aturan email terbaru dalam panduan menetapkan penerima TO/CC. Karena itu, tes settings tidak lagi mengharapkan `defaultEmailTo`; alamat email tetap tetap dan tidak dapat diubah lewat action ini.

## Tes dan pemeriksaan

- Sebelum perubahan: `node --test tests/utp-domain.test.js tests/utp-storage.test.js` — 28 lulus, 6 gagal dari 34.
- Setelah perubahan: `node --test tests/utp-domain.test.js tests/utp-storage.test.js` — 38 lulus, 0 gagal dari 38.
- Pemeriksaan sintaks `node --check` untuk `utp/Utp.gs`, `utp/UtpDomain.gs`, dan kedua file tes — lulus.
- `git diff --check` — lulus.

## Batasan dan pekerjaan tersisa

- Tes memakai layanan Google tiruan lokal; tidak membuktikan akses, izin, kuota, atau keberhasilan pada Drive/Sheets/Gmail cloud. Tidak ada akses cloud, push, commit, atau deployment yang dilakukan.
- Upload baru akan memakai folder privat tersendiri. File lama di folder arsip tidak dipindahkan dan izinnya sengaja tidak diubah; izin lama perlu ditinjau terpisah.
- Jika penulisan audit gagal setelah record tersimpan, backend mengembalikan error yang menyebut record sudah tersimpan agar pengguna tidak mengira perubahan batal. Audit delta di atas 45.000 karakter ditolak sebelum record ditulis.
- Action `settings` hanya mengizinkan `favorites`; alamat email penerima tetap mengikuti panduan bisnis.

## Kesiapan integrasi lokal

Backend siap diintegrasikan secara lokal untuk tahap berikutnya. Integrasi dan perilaku cloud tetap perlu diverifikasi di lingkungan yang berwenang sebelum dipakai atau dirilis.

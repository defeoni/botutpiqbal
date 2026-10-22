# Kinerja katalog Spek/Approval dan review merek

## Lanjutan 2026-10-22 — pencarian dan kesepakatan merek

Pencarian katalog/material dan dialog Spek memakai Nama barang, Merek (datalist), serta checkbox Bermerk/Tidak bermerek terkonfirmasi/Belum diketahui. Beberapa kategori memakai union; kosong berarti semua. Tidak menambah isian tipe/model; nama/model sumber dan aturan approval tetap utuh. Filter kelompok disembunyikan dari pencarian material, API lama tetap kompatibel.

Pencarian parsial tetap tersedia termasuk kode. `fuzzy:true` pada UI mengizinkan satu edit huruf untuk token alfabet 5–40 karakter pada nama barang saja, tanpa melonggarkan filter merek, ukuran/model atau aturan approval. Query API lama tetap exact substring jika fuzzy tidak diaktifkan. Ini bukan pencarian semantik/AI; pertukaran dua huruf belum didukung. Nomor/spesifikasi tidak ditebak.

Daftar tinjauan sampel, batas pencarian dan aturan ada di REVIEW-MEREK.md. Tidak ada perubahan master/label massal pada lanjutan ini; validasi sumber resmi dan AI belum dilakukan. Kamus merek terverifikasi belum disahkan.

Bukti source akhir: 50 tes terarah lulus (domain, cache, Spek backend/browser, kategori gabungan dan matcher FE/BE); 20 pemeriksaan browser material/navigasi lulus. Pemeriksaan browser awal menangkap test yang membaca hasil sebelum debounce selesai; test kini menunggu siklus pencarian. Generator 43 file, diff check bersih. Deployment Apps Script tetap menunggu VSCode.

Basis source d07ebba. Penyebab yang ditemukan: setiap pencarian membaca ulang semua baris master; aturan pencarian menormalisasi semua teks bahkan query kosong, menyalin setiap hasil sebelum pagination, dan memeriksa seluruh approval untuk setiap item.

Perbaikan:
- Utp.gs memakai cache master terkompresi dan dibagi potongan <=80 KB, TTL 120 detik. Key mencakup file/tab, waktu modifikasi, jumlah baris dan epoch impor. Cache hilang, rusak atau tidak tersedia kembali membaca Sheets. Impor melalui aplikasi menaikkan epoch.
- Favorit dan approval proyek tidak masuk cache; keduanya dibaca aktual. Kode barang tetap string termasuk nol awal.
- UtpDomain.gs melewati normalisasi teks saat query kosong, mengindeks kandidat approval per merek dengan urutan dan matcher lama, serta menyalin hanya hasil halaman (maksimal 50).
- Tidak mengubah aturan approval, klasifikasi generik, prioritas hasil atau kontrak API Spek.

Benchmark `node alat/ukur-pencarian-material.cjs` memakai data sintetis, bukan membaca seluruh master pengguna. 30.000 barang, 100 approval, tiga skenario diukur, median tiga run: sebelum 10.253 ms, sesudah 743 ms, 13,8x lebih cepat pada CPU lokal. Lima kasus kesetaraan hasil dibandingkan terhadap basis Git pada subset sintetis 2.000 barang. Ini bukan bukti latency Apps Script/Sheets produksi atau jaminan waktu loading tertentu.

Master yang diperiksa: https://docs.google.com/spreadsheets/d/1QwxMjbawlF1tZ_hVu0XVnRKIS1NtADFGy8RC8syRjYU/edit ; tab master, sheetId 1716693419. Metadata menunjukkan grid 28.474 baris termasuk header. Pencarian bounded A1:I5000 dengan unknown mengembalikan hanya 25 sampel yang cocok, bukan seluruh master. Tidak melakukan pelabelan massal seluruh entri kosong.

Enam koreksi sudah ditulis ke Drive dan diverifikasi ulang melalui CellData. Kolom C (brand) awalnya kosong; kolom E (brandStatus) awalnya unknown, kini explicit karena nama barang sendiri mencantumkan merek secara jelas:

| Baris | Kode | Merek C | Status E |
|---|---|---|---|
| 67 | 51030162 | AUX | explicit |
| 236 | 51030309 | BESTLIFE | explicit |
| 352 | 51030322 | CAWANG | explicit |
| 378 | 64000077 | H&L | explicit |
| 491 | 40250064 | KIIP | explicit |
| 493 | 40220020 | HOWELL | explicit |

Kode, nama asli, kandidat, model, satuan, formula dan format sel tidak diubah. Penandaan explicit adalah label identitas merek dari nama, bukan persetujuan material. Micro USB, Gold dan penyebutan HILDA TAFFWARE dalam keterangan kompatibilitas belum ditetapkan mereknya. Berkas Excel sumber asli tidak diubah.

Batas produksi: Apps Script dapat memakai master lokal dalam database atau property UTP_MASTER_SOURCE_ID yang mengalahkan referensi ini. Binding produksi tersebut belum dapat dibaca dari Cloud; perubahan merek pada referensi tidak membuktikan semua salinan lokal ikut berubah. Perbaikan source perlu finishing VSCode/deployment. Saat verifikasi gunakan sumber aktif yang benar; perubahan manual sumber yang sama dapat bertahan di cache maksimum sekitar dua menit.

Bukti: suite 231 tes lulus, nol gagal/skip. Tes baru mencakup warm-cache tanpa pembacaan ulang, revisi sumber/epoch impor, chunk terhapus dan cache tidak tersedia, favorit aktual, string kode, penyalinan hanya 50 dari 30.000 hasil, serta kecocokan approval multi-merek/generik. Generator clasp menghasilkan 43 file; diff check bersih.

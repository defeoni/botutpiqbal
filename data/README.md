# Master item lokal

`master_items.sample.csv` berisi empat baris sintetis untuk menjelaskan format.
Data bisnis lengkap tidak disimpan di folder ini.

Jalankan konverter dari root repository dengan Python yang menyediakan `openpyxl`:

```powershell
python tools/prepare_master_items.py "C:/Users/User/Downloads/PT.UTP - Master Item.xlsx" --self-test
```

Hasil lokal berada di `.local/master/master_items.csv` dan
`.local/master/master_items.stats.json`. Workbook sumber dibuka hanya untuk dibaca.
CSV memakai UTF-8, header tetap, dan urutan baris sumber. Konversi sumber yang sama
menghasilkan byte CSV dan statistik yang sama. Statistik mencatat hash sumber dan
CSV, jumlah baris/kode unik, duplikat, kode berawalan nol, dan bukti parser.

| Kolom | Makna |
| --- | --- |
| `code` | Kode Item sebagai teks. Nol di depan dipertahankan. |
| `name` | Nama Item asli, tanpa normalisasi teks. |
| `brand` | Merk dari kolom resmi, tanpa menggantinya dengan hasil tebakan. |
| `brandCandidate` | Kandidat yang dibaca dari nama. Tidak berarti sudah dikonfirmasi. |
| `brandStatus` | `explicit`, `candidate`, `unknown`, atau `generic`. |
| `model` | Teks model setelah `\|` atau `#` yang mengikuti kandidat merek. |
| `unit` | Sat asli. |
| `group` | Kelompok asli. |
| `family` | Family asli. |

`explicit` berarti kolom Merk terisi nilai spesifik. `candidate` berarti potongan
nama cocok dengan kamus merek terstruktur atau muncul berulang sebagai kandidat
yang masuk akal. `unknown` berarti bukti belum cukup, termasuk kandidat baru yang
hanya muncul sekali, nilai seperti `LOKAL`, warna, bahan, atau deskripsi pemasangan.
`generic` hanya boleh ditetapkan setelah konfirmasi manusia bahwa material memang
tanpa merek. Konverter tidak menetapkan `generic` secara otomatis. Semua item selain
`explicit` memerlukan konfirmasi sebelum merek dipakai sebagai pilihan final.

Parser mencari potongan setelah koma terakhir sebelum `|` atau `#`; bila tidak ada
delimiter, potongan setelah koma terakhir dapat menjadi kandidat tanpa model.
Huruf kapital saja tidak cukup. Warna, ukuran, bahan, dan istilah pemasangan tidak
masuk kamus kandidat. Model setelah `#` harus didahului kandidat merek; ukuran seperti
`#0.4 mm` tidak dianggap model. Bukti ekstraksi model dihitung dalam statistik,
tanpa memberikan angka keyakinan yang tidak terkalibrasi.

Kamus kandidat adalah bantuan peninjauan, bukan daftar merek resmi. Nama merek
baru yang berulang tetap tidak mengisi kolom `brand`. CSV tidak menggabungkan atau
menghapus baris duplikat. Jangan membuka lalu menyimpan CSV dengan inferensi angka
Excel, karena Excel dapat menghapus nol di depan kode. Saat mengimpor ke Sheets,
perlakukan `code` sebagai teks dan jangan memakai inferensi tipe otomatis.

## Struktur sumber yang diperiksa

- Master: sheet `Mast, Items (Stock...)`, header baris 6; B kode, C nama, D merek,
  F kelompok, G family, K satuan. Data mulai baris 7. Sheet pivot/helper bukan master.
- Request material: sheet `12`, A4:J4 adalah nomor, kode barang, nama barang, qty,
  satuan, kode JO, tahap, baris, keterangan, SPP.
- Spesifikasi ME: sheet `ELEKTRIKAL`, `ELEKTRONIK`, `PEMADAM`. Kolom E berjudul
  `USULAN MERK`; kolom F berjudul `Usulan Kontraktor`, bukan status persetujuan.
  Nilai seperti `Compare` memerlukan pilihan pengguna sebelum menjadi merek final.
- Approval material: 20 sheet dengan isian material, kontraktor, tanggal, supplier,
  spesifikasi usulan (produk/type/kode/warna), spesifikasi kontrak, dan referensi.
  Pada contoh `Kabel Instalasi (Rev)`, label C17/C20:C23/C25:C26 menerima nilai di G.

Template hanya diperiksa strukturnya. Konverter ini tidak mengunggah data, mengubah
template, atau menetapkan persetujuan material.

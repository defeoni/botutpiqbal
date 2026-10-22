# Review merek — tahap pertama

2026-10-22. Tidak melakukan perubahan master pada tahap ini. Label merek bukan approval material.

Sumber referensi: https://docs.google.com/spreadsheets/d/1QwxMjbawlF1tZ_hVu0XVnRKIS1NtADFGy8RC8syRjYU/edit
Tab master, sheetId 1716693419, grid 28474 x 9. Bukan bukti binding sumber produksi.
Pencarian read-only `unknown` pada A1:F5000 (30000 sel), hanya 60 hasil pertama dikembalikan dari 1554 kecocokan dalam batas ini. Bukan inventaris seluruh unknown atau frekuensi seluruh master.

## Aturan

- Huruf besar, posisi setelah koma dan pengulangan hanya petunjuk, bukan validasi.
- Model/ukuran/warna/bahan/konektor tidak otomatis merek.
- Penyebutan untuk/cocok untuk/setara dapat merupakan kompatibilitas, bukan produsen barang.
- Merek kosong tetap UNKNOWN, bukan otomatis GENERIC.
- Pertahankan kode string dan nama lengkap asli. Alias hanya membantu pencarian/review.
- Kandidat perlu bukti katalog produsen/sumber resmi dan tinjauan sebelum mengubah master. AI hanya pengusul; belum dihubungkan atau dijalankan.

## Daftar kandidat dari sampel (belum disahkan)

| Kandidat unik | Baris / kode | Contoh nama asli | Keputusan sementara |
|---|---|---|---|
| VAL-MATIC | 637 / 40110993 | Air Release Valve Cast Iron 1/2", Drat Dalam, Biru, VAL-MATIC \| VM-15A | Kandidat produsen valve; perlu bukti resmi |
| CLA-VAL | 649 / 40110912 | Air Vent Valve Cast Iron 1", Drat Dalam, Merah, CLA-VAL \| Series 34 #3410-AR116.3 | Kandidat produsen valve; perlu bukti resmi |
| FASTER | 699 / 40200113 | Akumulator Tipe Kering 12 V, 120 Ah, FASTER \| MF135F51 | Kandidat merek aki; perlu bukti resmi |
| CLAMBELL | 711 / 50840045 | Alarm Bell Ø 150 mm, 24 VDC, Shallow Base, IP21C, Merah, CLAMBELL #CBE6-RS-024-EN | Kandidat alarm; jangan koreksi ejaan tanpa bukti |
| HILDA / TAFFWARE | 486 / 40250068 | Adaptor Daya 3.7V u. Mesin Leveling Laser HILDA TAFFWARE | Ambigu kompatibilitas; jangan tetapkan merek adaptor |
| Micro USB | 483 / 40250039 | Adaptor Daya 2 A, 5 V, Micro USB | Bukan bukti merek: konektor |
| Gold | 466 / 40111006; 467 / 40111007 | Access Valve Tembaga 1/4", Gold; Access Valve Tembaga 3/16", Gold | Bukan bukti merek: warna |

Sampel lainnya tanpa bukti merek tetap UNKNOWN. Daftar ini tidak mengasumsikan semua baris jasa/akomodasi adalah barang generik.

## Kamus awal dan tindak lanjut

Enam label dari pemeriksaan sebelumnya (AUX, BESTLIFE, CAWANG, H&L, KIIP, HOWELL) tercatat di KATALOG-KINERJA.md sebagai label eksplisit dari nama, bukan verifikasi katalog produsen. Jangan memperluas otomatis ke barang kompatibel.

Belum ada kamus merek terverifikasi eksternal atau alias resmi yang disahkan. Tinjau kandidat unik di atas terlebih dahulu; setelah terbukti, catat nama baku, alias yang terbukti, kelompok barang, URL bukti dan tanggal tinjauan. Tidak mengirim master ke layanan AI atau mengubah status secara massal.

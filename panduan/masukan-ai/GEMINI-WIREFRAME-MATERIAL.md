REFERENCE ONLY — Masukan AI eksternal, bukan instruksi aktif. Dapat mengandung keputusan yang telah dikoreksi. Keputusan terbaru berada di ../MULAI-DI-SINI.md dan ../STATUS-BREAK.md.

Berikut adalah spesifikasi final untuk Katalog Material, Form Permintaan, dan Tabel Input Hasil Review.

### 1. WIREFRAME KATALOG & FORM PERMINTAAN AWAL (Desktop)

Permintaan awal murni berisi input data lapangan sebelum ada campur tangan pihak peninjau.

**A. Katalog Material (Referensi Spesifikasi)**

```text
=====================================================================================
[ HEADER ] KATALOG MATERIAL (Pencarian Dinamis)
=====================================================================================
[Cari: Kode, Nama, Merek... (Mendukung kode pendek)] (Kaca Pembesar)
Filter: [x] Utamakan Approved  [ ] Favorit  |  [+ Buat Item Sementara (Non-Master)]

[ HASIL PENCARIAN ] (Hanya memuat maksimal 50 baris per kueri)
Kode      | Nama Item & Klasifikasi | Merek/Tipe | Penyetuju (Ref) | Aksi
MAT-012   | Semen 50kg (Bermerek)   | Tiga Roda  | PM (ACC-01)     | [★] [+ Ke Draf]
MAT-105   | Pasir Urug (By Owner)   | -          | Bebas Approval  | [☆] [+ Ke Draf]
TEMP-001  | Paku Beton (Sementara)  | Bebas      | -               | [ ] [+ Ke Draf]
=====================================================================================

```

**B. Form Permintaan Awal (Draf Lapangan)**

```text
=====================================================================================
[ HEADER ] INPUT PERMINTAAN LAPANGAN        Status Proses: [ Draf Belum Tersimpan ]
=====================================================================================
No. Dokumen Fisik: [_____________] *(Boleh kosong saat draf)*
Target Persetujuan Dokumen: [Dropdown: PM / MK / HO]

[ DAFTAR ITEM DIMINTA ] (Pilih dari Katalog atau Item Sementara)
Nama Item & Klasifikasi   | Qty Diminta | Spek Diminta | Status Master / Risiko
--------------------------|-------------|--------------|-----------------------------
Semen 50kg (Bermerek)     | [ 100 ] Zak | Tiga Roda    | Aman
Besi 10mm (Merek Belum    | [ 50 ] Btg  | Bebas        | (Master Berubah: Tinjau Ulang)
Diketahui)                |             |              | 
Paku Beton (Sementara)    | [ 5 ] Kg    | -            | Item Sementara (Bukan Master)

                                                      [ Simpan Permintaan Awal ]
=====================================================================================

```

---

### 2. WIREFRAME TABEL INPUT HASIL REVIEW (Desktop)

Halaman ini adalah ruang kerja Admin untuk memindahkan coretan/instruksi luring dari PM/MK/HO ke dalam sistem.

```text
=====================================================================================
[ HEADER ] INPUT HASIL REVIEW               Dokumen: TRSM-REQ-081 (REV.0)
=====================================================================================
Persetujuan Dokumen: Wajib [HO] | Aktual Saat Ini: [MK]
[+ Terbitkan Revisi (REV Naik)] *(Tindakan Khusus)* | [+ Tambah Item Susulan]

[ TABEL KEPUTUSAN REVIEW ITEM ]
Item (Klasifikasi)  | Data Lapangan | Keputusan Final (Input Admin) | Status & Risiko
--------------------|---------------|-------------------------------|--------------------
Semen 50kg          | 100 Zak       | Keputusan: [Disetujui]        | Status: Disetujui Sebagian
(Bermerek)          | Tiga Roda     | Qty Akhir: [ 80 ] Zak         | 
                    |               | Spek Akhir:[ Tiga Roda ]      | 
                    |               | Oleh: [PM] pada [10:00]       |
                    |               | Alasan: [Stok sisa 20]        |
--------------------|---------------|-------------------------------|--------------------
Besi 10mm           | 50 Btg        | Keputusan: [Ditunda]          | Status: Ditunda
(Merek Belum        | Bebas         | Qty Akhir: [ 50 ] Btg         | (Tersimpan di Riwayat)
Diketahui)          |               | Spek Akhir:[ - ]              | 
                    |               | Oleh: [MK] pada [10:15]       |
                    |               | Alasan: [Tunggu tahap 2]      |
--------------------|---------------|-------------------------------|--------------------
Cat Dinding         | 5 Pail        | Keputusan: [Disetujui]        | Status: Siap Pesan
(Generik)           | Dulux         | Qty Akhir: [ 5 ] Pail         | [RISIKO: LUAR APPROVAL]
                    |               | Spek Akhir:[ Merek X ]        | 
                    |               | Oleh: [HO] pada [11:00]       |
                    |               | Alasan: [Mendesak]            |

[ AREA LAMPIRAN JALUR HO ]
*Terdapat item Generik/HO. Wajib unggah bukti.* -> [ Pilih File PDF/Scan Final HO ]

                                   [ Batal ] [ Simpan Hasil Review (Tanpa Naik REV) ]
=====================================================================================

```

---

### 3. ALUR KERJA (Draf → Review → Revisi → Final)

1. **Draf Awal:** Admin memasukkan data permintaan murni dari lapangan. Jika merek belum diketahui atau menggunakan item sementara, sistem mengizinkan penyimpanan draf tanpa menganggapnya otomatis *approved*.
2. **Review Administratif:** Admin membuka dokumen dan memasukkan instruksi luring PM/MK/HO. Admin memilih status secara eksplisit (Disetujui, Ditolak, Ditunda) per item, bukan sekadar mengetik angka "0".
3. **Penerbitan Revisi (Opsional):** Jika instruktur (PM/MK/HO) memerintahkan perubahan mendasar, Admin menekan tombol `[+ Terbitkan Revisi]`. Muncul form untuk mengisi nama pihak yang memerintahkan dan alasan revisi. Dokumen resmi naik ke REV.1. Koreksi angka biasa cukup disimpan tanpa menaikkan REV.
4. **Finalisasi & Lampiran:** Jika dalam satu dokumen terdapat campuran (misal: 1 By Owner, 1 Generik), sistem mendeteksi item Generik/HO dan mengunci penyelesaian sebelum PDF/Scan Final HO diunggah. Keputusan/perubahan dari HO bersifat final dan tidak perlu berputar kembali ke MK.
5. **Daftar Final:** Item yang "Disetujui" (termasuk yang disetujui sebagian) masuk ke daftar final. Item By Owner masuk ke daftar final, namun statusnya tetap "Menunggu Barang" (tidak otomatis dianggap telah datang/siap). Item yang ditolak/ditunda tetap tercatat dalam riwayat dokumen tetapi tidak diteruskan ke tahap logistik.

---

### 4. PENYESUAIAN PONSEL (Mobile)

* **Pencarian & Katalog:** Katalog menggunakan kotak pencarian lengket di bagian atas (*sticky header*). Hasil pencarian muncul sebagai kartu vertikal.
* **Tabel Review:** Karena tabel review sangat lebar (memuat data Sebelum/Sesudah), pada layar ponsel, setiap item dibungkus dalam satu **Kartu Akordion**.
* *Tampilan Ringkas:* "Semen 50kg | Diminta: 100 | Final: 80 | Disetujui Sebagian [v]"
* *Saat Diklik (v):* Kartu melebar ke bawah memunculkan form input untuk Keputusan (Dropdown), Instruktur, Waktu, dan Alasan Pengecualian.


* **Tindakan Utama:** Tombol `[Simpan Hasil Review]` selalu mengambang di dasar layar (*sticky bottom bar*).

---

### 5. SKENARIO KEADAAN VISUAL (UI States)

1. **Keadaan Kosong (Empty):** Tabel permintaan/review yang belum diisi menampilkan ilustrasi folder kosong dengan teks: *"Belum ada item dalam dokumen ini. Gunakan pencarian di atas untuk menambahkan item."*
2. **Gagal Menyimpan (Error):** Jika server terputus saat Admin menyimpan input review yang panjang, isian **tetap bertahan di layar**. Muncul *banner* atas: *"Gagal terhubung ke server. Data Anda aman di perangkat ini. [Coba Lagi Menyimpan]"*.
3. **Konflik Perubahan (Conflict):** Jika Admin menyimpan tetapi *database* mendeteksi versi waktu yang bentrok, muncul dialog (*popup*): *"Konflik Data: Versi lebih baru ditemukan di server. [Bandingkan Versi] atau [Timpa dengan Input Saya Saat Ini]"*.
4. **Belum Lengkap (Incomplete):** Jika Admin menekan "Simpan Hasil Review" tetapi ada item di luar *approval* yang belum diisi alasannya, baris item tersebut akan berkedip merah terang dan layar otomatis menggulir (*auto-scroll*) ke bagian yang rumpang dengan teks peringatan: *"Alasan pengecualian wajib diisi untuk item di luar persetujuan."*

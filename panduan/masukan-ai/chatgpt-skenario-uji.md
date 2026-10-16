REFERENCE ONLY — Masukan AI eksternal, bukan instruksi aktif. Dapat mengandung keputusan yang telah dikoreksi. Keputusan terbaru berada di ../MULAI-DI-SINI.md dan ../STATUS-BREAK.md.

Berikut daftar uji manual yang bisa langsung dipakai untuk prototipe maupun implementasi nanti.

## A. Alur utama

| ID | Kondisi awal | Tindakan admin | Hasil yang diharapkan |
|---|---|---|---|
| A01 | Draf permintaan material Terrasentra Bandung belum memiliki nomor resmi. Ada 4 item: **Semen Tiga Roda** jalur PM, **Pasir pasang generik terkonfirmasi** jalur MK, **Keramik merek belum diketahui** jalur HO, dan **Lampu dekoratif By Owner**. | Admin membuat dan menyimpan permintaan. | Draf dapat disimpan tanpa nomor fisik. Setiap item menyimpan klasifikasi dan jalur masing-masing. By Owner tidak meminta approval, brosur, atau final HO. |
| A02 | Item **Semen Tiga Roda** membutuhkan persetujuan PM. Belum ada keputusan PM. | Admin membuka status item. | Item tetap menunjukkan bahwa persetujuan yang diperlukan belum tercapai dan belum dianggap disetujui. |
| A03 | Item **Keramik merek belum diketahui** berada pada jalur HO. Persetujuan proses sudah tercatat, tetapi PDF/scan final HO belum diunggah. | Admin mencoba melanjutkan item sebagai memenuhi persyaratan. | Item belum memenuhi persyaratan final karena bukti PDF/scan HO masih belum tersedia. Item non-HO tidak ikut diwajibkan memiliki final HO. |
| A04 | Dalam satu permintaan terdapat 3 item: Semen sudah memenuhi syarat; pasir masih menunggu MK; keramik ditolak. | Admin melanjutkan Semen. | Semen dapat lanjut sendiri. Status pasir dan keramik tidak menghalangi item Semen yang sudah memenuhi persyaratan. |
| A05 | Item **Keramik lantai** belum diketahui mereknya saat permintaan dibuat. | Admin memilih klasifikasi **merek belum diketahui** dan menyimpan. | Item tercatat sebagai **merek belum diketahui**, bukan sebagai generik. |
| A06 | Item **Pasir pasang** tidak menggunakan merek tertentu dan sudah dikonfirmasi sebagai generik. | Admin memilih **generik terkonfirmasi**. | Item tercatat sebagai generik dan tetap membutuhkan approval sesuai jalur item tersebut. |
| A07 | Item **Besi Ø10** berasal dari daftar sementara lapangan dan klasifikasinya **bermerek**. | Admin menandai sumber item sebagai **Sementara** dan menyimpan. | Status **Sementara** tersimpan terpisah dari klasifikasi **bermerek**. Mengubah salah satunya tidak otomatis mengubah yang lain. |
| A08 | Material master memiliki kode **00127** dan **00045**. | Admin mencari `127`, lalu `45`, lalu membuka item hasil pencarian. | Pencarian kode pendek menemukan kode dengan nol awal yang sesuai. Kode tetap ditampilkan sebagai `00127` dan `00045`; nol awal tidak hilang. Master tidak ditampilkan atau diperlakukan sebagai jumlah stok. |
| A09 | Permintaan REV berjalan memiliki item Semen qty 100 zak. PM memberi hasil review menjadi 80 zak dengan alasan kebutuhan lapangan berubah. | Admin mencatat review: 100 → 80, pihak PM, waktu, dan alasan; lalu memilih **Simpan Review**. | Riwayat menunjukkan nilai sebelum dan sesudah, pihak, waktu, dan alasan. Nomor REV tidak berubah hanya karena **Simpan Review**. |
| A10 | Review pada A09 sudah tersimpan. | Admin memilih **Terbitkan Revisi**. | Sistem meminta instruksi pihak terkait PM/MK/HO dan alasan penerbitan revisi sebelum REV diterbitkan. Penerbitan revisi terpisah dari penyimpanan review. |
| A11 | Item jalur HO sebelumnya sudah melewati MK. HO kemudian mengubah keputusan/spesifikasi item. | Admin mencatat perubahan hasil HO. | Perubahan HO menjadi hasil terbaru pada jalur tersebut dan tidak dikirim kembali ke MK untuk pengulangan proses. |
| A12 | Permintaan memiliki 5 item. PM menyetujui 3 item; untuk salah satu item yang disetujui jumlah dikurangi dari 50 menjadi 30. | Admin menyimpan hasil review. | Pengurangan jumlah pada satu item dicatat sebagai perubahan jumlah item tersebut. Sistem tidak menafsirkannya sebagai “persetujuan sebagian daftar” untuk item lain. |

## B. Kasus berisiko dan pemulihan

| ID | Kondisi awal | Tindakan admin | Hasil yang diharapkan |
|---|---|---|---|
| B01 | Item **Cat Eksterior Merek A** yang akan dipakai tidak sesuai dengan approval aktual yang tersedia. | Admin memilih tetap menggunakan barang di luar approval dan mengisi alasan. | Item dapat dicatat sebagai pengecualian, tetapi tampil dengan risiko **merah** beserta teks/alasan. Pengecualian tidak mengubah approval item lain dan tidak menjadi approval global. |
| B02 | Permintaan berisi Semen disetujui, Pasir ditunda, Keramik ditolak, dan Pintu masih belum lengkap dokumennya. | Admin memilih Semen untuk dilanjutkan. | Semen tetap dapat lanjut karena memenuhi persyaratan sendiri. Kondisi item lain tidak memblokirnya. |
| B03 | Admin telah mengisi klasifikasi, qty, alasan, dan hasil review beberapa item. Saat menekan Simpan terjadi kegagalan penyimpanan. | Admin melihat pesan gagal lalu memeriksa kembali form. | Seluruh isian yang belum berhasil disimpan tetap tersedia dan tidak dikosongkan. Admin dapat memperbaiki atau mencoba menyimpan kembali tanpa mengetik ulang seluruh data. |
| B04 | Perangkat A dan perangkat B membuka permintaan yang sama pada versi yang sama. Perangkat A menyimpan perubahan terlebih dahulu. | Setelah itu perangkat B mencoba menyimpan perubahan dari versi lama. | Sistem mendeteksi konflik. Isian perangkat B tetap dipertahankan dan admin diminta membandingkan versi terbaru dengan versinya sebelum melakukan simpan ulang. Tidak terjadi penimpaan diam-diam. |
| B05 | Item jalur HO sudah disetujui secara substansi tetapi file final HO belum ada. Item lain jalur PM sudah lengkap. | Admin mencoba melanjutkan kedua item. | Item HO tetap tertahan karena final PDF/scan wajib belum diunggah. Item PM yang sudah lengkap tetap dapat lanjut. |
| B06 | Material sudah berada pada tahap penerimaan lapangan. Data jumlah, kondisi fisik, dan kelengkapan barang belum diverifikasi di modul ini. | Admin memilih **Barang Datang** lalu mengonfirmasi. | Sistem hanya mencatat konfirmasi **Barang Datang**. Sistem tidak menyimpulkan bahwa jumlah benar, barang tidak rusak, atau kelengkapan sudah diperiksa. |
| B07 | Item **Sanitary Fixture** diklasifikasikan **By Other**. Tidak ada approval, brosur, maupun final HO. | Admin menyimpan dan melanjutkan item sesuai statusnya. | Item dapat diproses tanpa kewajiban approval, brosur, atau final HO. Sistem tidak memberikan peringatan kekurangan dokumen approval untuk item tersebut. |

Set ini berjumlah **17 skenario** dan mencakup seluruh kondisi wajib, termasuk pemisahan status sementara, approval per item, jalur HO, revisi, konflik dua perangkat, serta batas makna **Barang Datang**.

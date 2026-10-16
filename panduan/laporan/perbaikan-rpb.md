# Hasil perbaikan RPB

## Temuan dan perubahan

- `rpb/RPB.gs:54`, `rpb/RPBClient.html:167`: simpan draf tanpa pengurutan versi memungkinkan permintaan lama yang terlambat menimpa draf baru; respons lama juga dapat datang saat pengajuan berjalan. Simpan draf kini memakai versi monotonik dan lock, versi draf yang diajukan dikonsumsi saat berhasil, callback basi diabaikan, pemuatan draf tidak menimpa form yang telah disentuh, dan form dikunci selama pembuatan arsip.
- `rpb/RPB.gs:147`, `rpb/RPBClient.html:313`: API tracking menerima parameter PIN tetapi tidak memeriksanya, sementara UI mengirim PIN kosong. API kini memanggil `requireDeletePin_`, dan UI meminta PIN sebelum mengubah tracking.
- `rpb/RPB.gs:634`: penanganan kategori template tak dikenal merujuk `offset` yang tidak didefinisikan. Iterasi kini menerima indeks baris agar pesan kesalahan kontekstual.
- `rpb/RPB.gs:256`: validasi sebelumnya tidak menolak hasil perkalian jumlah dan harga yang overflow menjadi Infinity; sekarang total tersebut ditolak. Pemeriksaan bulan LPD sebelumnya memakai aritmetika tahun-bulan langsung, termasuk pergantian tahun.
- `rpb/RPB.gs:133`, `rpb/RPBClient.html:207`: kegagalan membersihkan file sementara kini dilaporkan untuk pemeriksaan folder arsip, dan panel sukses lama disembunyikan saat pengajuan baru dimulai.

Tes ditambahkan di `tests/rpb-contract.test.js` menggunakan `node:test`, `assert`, dan `vm`.

## Verifikasi lokal

- `node --test tests\rpb-contract.test.js` — lulus, 7/7 tes; termasuk parsing sintaks backend dan JavaScript client.
- `node --check tests\rpb-contract.test.js` — lulus.
- `git diff --check -- rpb/RPB.gs rpb/RPBClient.html` — lulus.

## Batasan

Tidak ada deployment atau akses cloud. Pembuatan/format spreadsheet, ekspor Excel/PDF, dan keberhasilan pembersihan file Drive belum dapat diuji lokal. Kepatuhan daftar master terhadap aturan “nonmaterial” juga perlu pemeriksaan data cloud: kode lokal tidak menyediakan penanda yang dapat membedakan barang material pada kategori generik.

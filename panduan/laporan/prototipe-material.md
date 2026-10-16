# Prototipe material — 16 Oktober 2026

Dikerjakan Codex dari HTML Gemini, dengan satu peninjau terarah. Ini prototipe mandiri; bukan aplikasi produksi atau penyimpanan cloud.

## Hasil

- `pratinjau/prototipe-material.html`: revisi beralasan menyimpan snapshot, pihak dan waktu; riwayat dokumen/item dapat dilihat.
- Keputusan per pihak, cakupan satu lampiran HO untuk beberapa item, kesiapan per item dan pengecualian By Owner/By Other.
- Permintaan awal terkunci saat mulai review; item yang sudah direview tidak dapat hilang melalui Hapus/Kosongkan Draf.
- Konflik membandingkan dan menerapkan pilihan per field; perubahan server/lokal setelah dialog membuka perbandingan ulang.
- Konfirmasi klasifikasi merek belum diketahui eksplisit dan diaudit tanpa mengubah master contoh.
- Perubahan HO tidak kembali ke MK. Perubahan tahap sebelumnya menandai tahap sesudahnya untuk ditinjau ulang.
- Masukan teks dirender dengan escaping; jumlah positif/finite, kosong berbeda dari nol.

## Verifikasi aktual

`alat/periksa-prototipe-material.cjs` dijalankan dengan Playwright yang tersedia dan Chrome headless lokal: **17/17 skenario lulus**. Mencakup konflik, snapshot, risiko, keputusan, lampiran, teks mirip HTML, kode pendek, navigasi serta containment viewport 1440x900/390x844. Pemeriksaan sintaks skrip pemeriksaan lulus.

Tidak mengunggah file atau menghubungkan layanan cloud. Data contoh hanya memori halaman, hilang saat dimuat ulang. Nomor file bukan bukti unggahan. Pemeriksaan browser otomatis tidak membuktikan penggunaan produksi ataupun runtime Apps Script.

Frontend terintegrasi dikerjakan sebagai tugas burst berikutnya; lihat laporan frontend terpisah setelah selesai.

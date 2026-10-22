# Brief desain PT UTP

Dokumen ini menjadi acuan Figma dan implementasi frontend.

## Tujuan

Pengguna harus dapat menjawab dengan cepat: apa yang sedang dikerjakan, kapan deadline, bagaimana posisi dana, dan apa tindakan berikutnya.

## Prinsip

- Desktop-first untuk 1366px dan 1920px.
- Satu aksi utama yang dominan pada setiap kondisi.
- Tampilan ringan tanpa animasi tambahan.
- Merah hanya untuk terlambat kirim.
- Oranye hanya untuk penyelesaian keuangan yang masih terbuka.
- Hijau hanya untuk selesai atau dana seimbang.
- Warna selalu disertai teks.
- Status dokumen dipisahkan dari status keuangan.
- Format tanggal dan Rupiah konsisten.

## Halaman prioritas

1. Pusat Dokumen: satu tombol Tambah Dokumen, satu Muat Ulang, filter terstruktur, dan hasil mudah dipindai.
2. Kanban: identitas, periode, tanggal deadline, nominal, status, dan satu aksi yang jelas pada setiap kartu.
3. Beranda HO: Dana Cair, Dana Terpakai, Menunggu Pengembalian, Kewajiban Perusahaan, dan RPD Disetujui Belum Cair.
4. RPB, RPD, dan LPD: pola form, kartu, nominal, periode, status, dan tombol utama konsisten.

## Batas desain

- Jangan mengubah rumus keuangan, API, autentikasi, atau struktur data melalui pekerjaan desain.
- Jangan menghasilkan source produksi dari alat desain secara otomatis.
- Setiap rancangan harus mempunyai keadaan kosong, memuat, gagal, draf, terlambat, dan selesai.
- Implementasi akhir wajib diperiksa pada aplikasi nyata dan diuji dengan Playwright.

# Administrasi Memo UTP

Versi cloud berbasis Google Apps Script. Setelah dipasang di akun Google, Google
menjalankan halaman dan bot webhook tanpa laptop yang selalu hidup. Penggunaan
tetap bergantung pada kuota, kebijakan, dan ketersediaan Google Apps Script;
layanan gratis tidak menjamin SLA atau uptime 24/7.

## Struktur file project

- `Code.gs`: API server, penyimpanan, pembuatan memo, Drive, dan Telegram.
- `Index.html`: struktur halaman dan komponen antarmuka.
- `Styles.html`: seluruh aturan tampilan dan responsif.
- `Client.html`: navigasi, formulir, interaksi tombol, dan pemanggilan API.
- `appsscript.json`: izin dan pengaturan deployment Apps Script.
- `tools/build_local_preview.py`: menyatukan tiga file HTML untuk pratinjau
  lokal; `Index-demo-lokal.html` adalah hasil generate dan tidak disalin ke
  project Apps Script.

Apps Script menampilkan file project dalam satu daftar, bukan folder. Pemisahan
menjadi `Index`, `Styles`, dan `Client` menjaga struktur antarmuka lebih mudah
ditelusuri tanpa memerlukan folder project yang tidak didukung editor Apps
Script.

## Fungsi

- Form web dan Telegram Mini App untuk memo PN, PG, dan SP.
- Navigasi utama MEMO, RPD, dan RPB; RPD/RPB disediakan sebagai halaman kosong.
- Direktori manpower persisten, dengan status aktif/nonaktif dan filter nama,
  proyek, bidang, keahlian, dan rentang tanggal mulai. Data yang sudah ada
  sebelum aplikasi digunakan dapat dimasukkan lewat formulir personel manual.
- Perintah privat Telegram: `/start`, `/new`, `/pn`, `/pg`, `/sp`, `/status`,
  `/reset`, dan `/setwebhook`.
- Setiap penghapusan riwayat memo, manpower, baris personel, dan Hard Reset
  meminta PIN konfirmasi `461999`; server memeriksa PIN sebelum menghapus.
- Preview wajib sebelum nomor dialokasikan. Counter bulanan ada di server,
  dikunci saat penomoran, dan hanya bertambah setelah arsip berhasil dibuat.
- Penomoran berjalan dengan counter terpisah untuk PN, PG, dan SP; counter
  dimulai dari 0 sehingga nomor dokumen pertama berakhiran `/01`. Bulan dan
  tahun nomor mengikuti tanggal dokumen yang dipilih pada kalender.
- Tanggal dokumen, tanggal efektif, dan tanggal personel dipilih melalui kontrol
  kalender pada formulir web.
- Semua memo yang berhasil dibuat dicatat di riwayat Google Drive. Riwayat
  menampilkan thumbnail, nomor memo, pencarian, filter, halaman, tautan Sheets,
  pembuatan PDF jika belum tersedia, draf WhatsApp, serta hapus per memo.
  Pengaturan menyediakan hapus seluruh riwayat; penghapusan memindahkan file
  memo terkait ke Sampah Google Drive.
- Data Manpower memiliki aksi hapus per personel dan proyek. Penghapusan
  menghapus catatan direktori untuk pasangan nama/proyek tersebut, sementara
  arsip dokumen memo terkait tetap dikelola dari Riwayat Memo.
- Telegram `/start` menampilkan sambutan dan tombol untuk membuka website,
  formulir memo, jenis memo, dan status nomor dokumen.
  Foto KTP menjadi sheet kedua `Lampiran KTP` pada spreadsheet memo.
- Foto KTP dipilih per baris personel, diberi nama khusus, disimpan sebagai
  file privat di folder arsip, dan ditampilkan dua kolom pada sheet kedua
  `Lampiran KTP`.
- Ukuran font pada isi lembar memo diseragamkan menjadi 12. Perubahan pada
  desain/template Google Sheets sumber akan dipakai oleh memo baru, kecuali
  sel data yang memang diisi otomatis oleh aplikasi.
- Google Sheets dan PDF dapat dipilih terpisah. Draf WhatsApp hanya dibuat
  untuk disalin dan tidak dikirim otomatis.
- Memo PN, PG, dan SP dibuat dari salinan template baku masing-masing. Format,
  warna, logo, dan tanda tangan pada template dipertahankan; data header dan
  jumlah baris personel diisi oleh aplikasi.
- Maksimal 30 foto KTP per memo. Setiap foto maksimal 5 MB sebelum kompresi
  dan 750 KB setelah kompresi.
- Direktori manpower tersimpan di spreadsheet terpisah bernama
  `Data Manpower UTP`; hard reset arsip memo tidak menghapus direktori ini.
- Aplikasi mengelompokkan catatan berdasarkan nama lengkap dan proyek.
  Jika ada dua pekerja bernama sama di proyek yang sama, tinjau roster agar
  status terbaru tidak tertukar.
- Struktur Drive:
  - `Arsip Memo UTP/<kode proyek>/<YYYY-MM>/`: Spreadsheet memo, PDF, dan foto
    KTP dikelompokkan bersama per proyek dan bulan.
  - `Arsip Memo UTP/Riwayat Memo UTP`: spreadsheet indeks riwayat.
  - `Data Manpower UTP`: spreadsheet terpisah agar data roster tidak tercampur
    dengan file memo.

Reset manual dapat membuat nomor yang pernah dipakai terbit kembali. Gunakan
hanya jika memang sudah dipastikan tidak akan menimbulkan nomor duplikat.

## Persiapan dan deploy pertama

1. Buat bot melalui `@BotFather` dan simpan token secara privat.
2. Buka [Google Apps Script](https://script.google.com/) dengan akun Google yang
   akan menjadi pemilik arsip. Buat project baru.
3. Di project Apps Script, buat tiga file HTML bernama `Index`, `Styles`, dan
   `Client`, lalu salin masing-masing file `.html` dengan nama yang sesuai dari
   folder ini. Ganti isi file `Code.gs` bawaan dengan `Code.gs` dari folder ini.
   Di Project Settings, aktifkan tampilan file `appsscript.json`, lalu salin
   manifest yang disertakan.
4. Unggah tiga file Excel template PN, PG, dan SP ke Google Drive. Buka setiap
   file dengan Google Sheets, lalu pilih **File → Save as Google Sheets**.
   Gunakan file hasil konversi (bukan `.xlsx`) sebagai template sumber. Buka
   setiap file hasil konversi dan salin ID dari URL di antara `/d/` dan
   `/edit`.
5. Pada **Project Settings → Script Properties**, tambahkan:

   | Nama | Nilai |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | Token dari BotFather |
   | `APP_OWNER_NAME` | Nama yang ditampilkan, mis. `IQBAL` |
   | `BOT_WEBHOOK_KEY` | Nilai acak rahasia, berbeda dari token bot |
   | `TEMPLATE_PN_ID` | ID file Google Sheets template Penambahan Manpower |
   | `TEMPLATE_PG_ID` | ID file Google Sheets template Penggantian OS |
   | `TEMPLATE_SP_ID` | ID file Google Sheets template Surplus Manpower |

   Jangan masukkan rahasia ini ke file proyek, Telegram chat, atau tangkapan
   layar. ID template bukan token rahasia, tetapi pastikan akun
   deployment memiliki akses ke ketiga file. Biarkan `OWNER_TELEGRAM_ID`
   kosong dahulu.
6. Di editor Apps Script, pilih fungsi `checkMemoTemplates`, lalu klik
   **Run/Jalankan**. Pastikan ketiga template dilaporkan siap digunakan.
   Biarkan `OWNER_TELEGRAM_ID` kosong untuk langkah pengenalan awal.
7. Pilih **Deploy → New deployment → Web app**. Gunakan **Execute as: Me** dan
   **Who has access: Anyone**, lalu deploy dan setujui izin Google. Endpoint
   perlu dapat menerima webhook Telegram. Karena aplikasi Web tidak memakai
   login, akses **Anyone** membuat semua fiturnya dapat dipakai siapa pun yang
   memiliki URL. Simpan dan jangan sebarkan URL `/exec` deployment.
8. Buka URL `/exec`; aplikasi langsung terbuka tanpa PIN. Pilih
   **Pengaturan**, lalu tekan **Hubungkan Bot Telegram**. Tindakan ini memasang
   URL webhook pada deployment. Tombol **Diagnostik Telegram** menunjukkan
   apakah URL terpasang dan apakah Telegram melaporkan error saat mencoba
   mengirim update. URL terpasang belum berarti pengiriman berhasil.
9. Kirim `/start` ke bot. Saat `OWNER_TELEGRAM_ID` masih kosong, bot membalas
   dengan ID akun Telegram yang mengirim pesan. Masukkan ID itu sebagai Script
   Property `OWNER_TELEGRAM_ID`, lalu kirim `/start` sekali lagi. Jangan gunakan
   ID orang lain. Tombol **Buka formulir memo** membuka Mini App.
   Perintah `/pn`, `/pg`, dan `/sp` membuka form dengan jenis yang dipilih.
10. Untuk memeriksa tampilan dan navigasi tanpa backend, jalankan
   `python tools/build_local_preview.py`, lalu buka `Index-demo-lokal.html`.
   Operasi yang menyimpan data hanya dapat diuji melalui URL `/exec` Apps
   Script.
11. Uji dengan data non-sensitif terlebih dahulu. Pastikan file uji muncul pada
   folder Drive privat dan nomor sesuai. Hapus data uji secara manual jika
   memang tidak diperlukan.

## Menelusuri error

- Status koneksi berada di bagian atas halaman. Tombol **Coba Hubungkan Ulang**
  membuat sesi Apps Script baru; halaman lokal akan menjelaskan bahwa backend
  Apps Script tidak tersedia pada `file://`.
- Error JavaScript dan penolakan proses asinkron ditampilkan di status itu dan
  dicatat di log browser. Error server ditampilkan dekat kontrol yang
  menjalankan operasi.
- Saat aplikasi online gagal, buka Apps Script **Executions** untuk melihat
  kegagalan backend beserta waktu dan fungsi yang dijalankan.
- Uji menu lokal melalui pratinjau; pembuatan memo, koneksi Telegram, dan
  penyimpanan Drive perlu diuji dari URL `/exec`.

Jika mengubah kode, buat versi deployment baru melalui **Manage deployments →
Edit → New version**. URL `/exec` biasanya tetap sama; setelah redeploy, uji
ulang web dan bot. Webhook dapat dipasang ulang dari halaman aplikasi.

## Memperbarui project Apps Script yang sudah ada

Project baru tidak wajib. Anda dapat memperbarui project lama jika memiliki
akses edit dan project tersebut masih dapat di-deploy sebagai Web App. Gunakan
project yang sama agar Script Properties, counter, dan akses ke arsip Drive
tetap berada di project yang sama.

1. Buka project lama dan pastikan project itu memang aplikasi memo yang ingin
   diperbarui. Buat salinan project atau simpan salinan kode lama sebelum
   mengganti apa pun. Pastikan juga akun Google yang menjalankan project masih
   memiliki akses ke folder arsip di Drive.
2. Di editor Apps Script, ganti isi file HTML `Index` dengan `Index.html` dari
   folder ini, lalu buat/perbarui file HTML `Styles` dan `Client` dari berkas
   yang sesuai. Ganti isi `Code.gs` dengan `Code.gs` dari folder ini. Jika
   file `Styles` atau `Client` belum ada, buat file HTML dengan nama tersebut.
   Jangan unggah `Index-demo-lokal.html` ke Apps Script; itu hanya pratinjau
   mandiri untuk komputer.
3. Periksa manifest `appsscript.json` dan sesuaikan dengan manifest dari folder
   ini. Jika project lama memiliki konfigurasi atau cakupan izin tambahan yang
   masih digunakan, tinjau sebelum menggantinya; jangan menghapus kebutuhan
   project lama tanpa memastikan dampaknya.
4. Buka **Project Settings → Script Properties**. Pertahankan properti lama
   yang masih dibutuhkan dan pastikan properti berikut tersedia. Nilai token
   bot yang sudah ada boleh digunakan kembali jika botnya sama.

   | Nama | Nilai |
   | --- | --- |
   | `TELEGRAM_BOT_TOKEN` | Token dari BotFather |
   | `APP_OWNER_NAME` | Nama akun pemilik yang ditampilkan, mis. `IQBAL` |
   | `BOT_WEBHOOK_KEY` | Nilai rahasia untuk webhook |
   | `OWNER_TELEGRAM_ID` | ID Telegram pemilik |
   | `TEMPLATE_PN_ID` | ID Google Sheets template Penambahan Manpower |
   | `TEMPLATE_PG_ID` | ID Google Sheets template Penggantian OS |
   | `TEMPLATE_SP_ID` | ID Google Sheets template Surplus Manpower |

   Jangan menghapus atau mengubah properti `COUNTER_...` secara manual. Counter
   disimpan di Script Properties; menggunakan project yang sama akan
   mempertahankan counter tersebut. Jangan menyalin rahasia ke source code.
   Untuk ID template, gunakan file Google Sheets hasil konversi dari tiga file
   Excel template baku—bukan file `.xlsx` aslinya. Jalankan `checkMemoTemplates`
   di editor Apps Script untuk memeriksa ketiga ID sebelum deploy.
   Perubahan desain dan teks statis pada file template sumber digunakan oleh
   memo baru. Sel isian seperti nomor, tanggal, nama proyek, penerima, dan tabel
   personel tetap ditulis oleh aplikasi. Reset counter hanya mengatur nomor
   selanjutnya. **Hard Reset** pada Web App meminta PIN konfirmasi `461999`.
   Hard reset
   memindahkan file di dalam folder arsip ke Sampah Google Drive, mengosongkan
   riwayat, serta mereset counter dari semua periode. Tiga file template, spreadsheet
   penyimpanan riwayat, dan Data Manpower tetap dipertahankan. Penghapusan dari
   Sampah Drive secara permanen tetap perlu dilakukan manual jika diinginkan.
5. Simpan perubahan dan jalankan fungsi yang diperlukan untuk memberikan izin
   Google jika diminta. Pastikan pengaturan Script Properties sudah benar
   sebelum memasang ulang webhook.
6. Pilih **Deploy → Manage deployments**, edit deployment Web App yang lama,
   pilih **New version**, lalu deploy. Pertahankan pengaturan yang sesuai:
   **Execute as: Me** dan **Who has access: Anyone**. URL `/exec` lama biasanya
   tetap sama; gunakan URL deployment yang ditampilkan setelah deploy.
7. Buka URL `/exec` (tidak ada langkah login), lalu uji aplikasi dengan
   data non-sensitif. Periksa bahwa memo uji tersimpan di folder Drive yang
   benar. Untuk menggunakan bot dengan deployment ini, buka menu
   **Pengaturan** dan tekan **Hubungkan Bot Telegram** agar webhook menunjuk ke
   URL deployment yang aktif. Tindakan ini tidak mereset counter, tetapi akan
   mengarahkan bot yang tokennya digunakan ke deployment ini.
8. Setelah pengujian berhasil, pastikan bot dan proses arsip berjalan sesuai
   kebutuhan sebelum digunakan untuk memo sungguhan. Jangan gunakan tombol
   reset counter sebagai bagian dari proses pembaruan.

## Operasional dan batasan

- Spreadsheet/PDF/foto dimiliki akun Google yang memasang Apps Script.
  Penerima tautan memerlukan izin Drive; aplikasi tidak membuat file publik.
- Bot hanya menjawab pemilik yang ID-nya cocok. Jika bot dapat menerima pesan
  di grup, bot tetap tidak memproses perintah anggota lain.
- Web App sengaja tidak memakai autentikasi. Pada deployment yang
  **Who has access: Anyone**, setiap orang yang mengetahui URL dapat melihat
  data, membuat memo, mengubah data manpower, dan menjalankan reset. Jangan
  gunakan mode akses publik untuk data sensitif atau rahasia perusahaan.
- Perintah `/reset` Telegram mengarahkan pengguna ke Web App. Reset dari menu
  **Pengaturan** meminta konfirmasi di layar, tanpa PIN. Counter disimpan per
  bulan Jakarta dan tidak bergantung pada penyimpanan browser.
- Google Apps Script memiliki kuota dan batas waktu eksekusi. Jika Google
  mencapai kuota, operasi akan gagal dengan pesan error dan counter tidak
  sengaja dinaikkan sebelum arsip selesai.
- Ini bukan layanan arsip perusahaan dengan SLA. Tinjau kebijakan perusahaan
  untuk penyimpanan KTP, batasi akses folder Drive, dan jangan membagikan
  token bot atau URL rahasia webhook.
- Saat ini nomor dibuat dari counter aplikasi. Arsip yang dibuat di luar aplikasi
  tidak otomatis masuk ke counter; lakukan rekonsiliasi sebelum penggunaan
  produksi.

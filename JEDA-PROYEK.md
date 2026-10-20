# Checkpoint jeda — 20 Oktober 2026

Status: WORK IN PROGRESS. Jangan finishing/deploy checkpoint ini sebelum integrasi berikut diselesaikan. User meminta jeda karena limit, bukan merilis aplikasi.

## Scope disepakati

- Proyek adalah tas kerja/folder induk; pemilih proyek tunggal / Semua Proyek.
- Identitas proyek: kode, nama, PM, MK, owner, lokasi, periode.
- Pusat Dokumen membedakan template, contoh terisi, referensi, arsip nyata. Tambah form kosong memakai modul Memo/RPB/RPD/Material/Approval yang sudah ada. Generator baru LPD/Kontrakan/Kasbon/Action Plan ditunda.
- Kanban dengan tracking/deadline, alasan wajib saat drag, detail/edit/arsip/hapus kartu. File Drive tetap ada.
- Foto/dokumen Telegram memilih proyek lalu Nota atau Arsip, sumber/lampiran/riwayat tersimpan. Tidak ada Instagram.
- Material: global sorting sebelum pagination, dropdown merek tersimpan, checkbox rapi.
- Manpower: profil opsional bertahap, kolom tambahan dan status kelengkapan; cetak browser ke PDF. Generator Word ditunda.
- Fokus PC, tanpa animasi; PIN aksi ditunda selama pengembangan, autentikasi pemilik dipertahankan.
- Alur rilis: Chat Codex push source ke GitHub, VS Code finishing fetch/test/fix/commit/push/deploy Apps Script. Checkpoint jeda ini harus diselesaikan dahulu.

## Perubahan dalam checkpoint

- Projects.gs / ProjectsClient.html: registry proyek server, identitas, pemilih global, legacy tanpa penempatan otomatis.
- DocumentCenterClient.html: controller katalog/arsip server, form kosong, kanban, tracking, deadline, dialog dan hapus kartu. DocumentCenter.html mempertahankan daftar Drive asli sebagai sumber katalog.
- Projects.gs mengindeks Memo, RPB, RPD, workspace, material dan hasil ekspor; tracking kanban terpisah dari keputusan approval asli.
- ProjectTools.html: buka arsip/nota, detail lampiran dan riwayat, tugas dengan tautan dokumen, cache daftar per proyek, form collapse.
- TelegramConnection.gs: media -> pilih proyek -> Nota/Arsip; deduplikasi pesan, private owner guard, polling lock terintegrasi Memo.gs.
- UtpClient/UtpStyles/UtpDomain: sorting server sebelum pagination, pilihan merek, scoping UI material, createBlank dan PIN development.
- PeopleProfiles.gs/html: profil bertahap dengan versi optimistis, kelengkapan, custom fields, cetak browser PDF.
- RPD.html: cache proyek/sesi, reset pergantian proyek, createBlank/openRecord dan dirty/busy guards.
- RPB: projectId, header dan folder dinamis, draf terpisah per proyek. Memo: mapping memoProjects untuk record baru.
- Source generator clasp/preview sudah mencantumkan file baru; belum dijalankan.

## Wajib diselesaikan saat melanjutkan

1. Integrasi ProjectsClient.select: tambahkan guard dialog Dokumen/busy; tutup/reset dialog dan pending state saat proyek berubah. Guard RPD sudah ditambahkan ke selection. Hindari isian Memo/RPB tertukar proyek, bersihkan timer autosave RPB saat pindah dengan konfirmasi. ProjectsClient request generation sudah ditambahkan, perlu reread final.
2. Blank routes: RPD createBlank harus sebelum switchMainPage; Material createBlank juga perlu sebelum switch yang memulai bootstrap, agar tidak gagal karena loading. Pastikan membuat lembar baru benar-benar mengosongkan isian dengan konfirmasi tanpa menghilangkan arsip.
3. Hubungkan kartu draf dengan record asli sesudah form diproses; saat ini kartu draf dan record sumber dapat tampil terpisah. Jangan mengklaim workflow terhubung penuh sebelum ini selesai.
4. Bersihkan identitas statis di Index.html (projectName/projectCode/waRecipient) dan sinkronkan dengan proyek aktif. HomeView sudah memakai selector.
5. PIN: requireDeletePin_ development switch, askDeletePin_, ownerSession pinDeferred serta frontend capability sudah diterapkan. Tetap tinjau sesi/login; autentikasi pemilik wajib.
6. Search material: wrapper sudah mengirim projectId untuk searchItems dan backend sudah memfilter approval proyek. UI daftar scoped, backend sorting sudah ada; tinjau context approval saat perintah submit/finalize (utpContext_ masih membaca approval semua proyek).
7. RPD export DocumentExports.gs masih header/folder memakai RPB_CONFIG: ikat metadata proyek record aslinya. Jangan memodifikasi format/template bisnis.
8. RPB WhatsApp project name/PM dinamis sudah diubah; cek keseluruhan RPB history scope, delete-all (jangan lintas proyek), revisi dan draf versi serta callback lama setelah pindah proyek.
9. Workspace index reminders: gunakan deadline eksplisit. Saat ini tanggal RPD perlu dipakai sebagai due, nota/arsip jangan otomatis dianggap deadline.
10. Katalog reminder caption masih menyebut contoh UI, ganti karena data sudah server. Periksa ukuran font/filter counts. Tambahkan clear filters dan opsi asal template jika diperlukan; controller baru belum memuat semua kenyamanan lama.
11. Performa Memo: apiGetMemoHistory saat ini utpGet memoProjects per row dan migrasi folder setiap load; baca mapping sekali agar tidak O(n²). Dashboard memiliki pola lookup serupa.
12. Tangani audit warning pascasimpan apiProjects/apiProjectDocument; utpWrite_ bisa berhasil tetapi melempar recordSaved. Jangan memunculkan simpan gagal bila sudah tersimpan.
13. Review seluruh diff dan kontrak, terutama backend project scoping, dedupe file per proyek, asynchronous reset/session, dan source includes. Belum ada uji runtime.

## Verifikasi dan rilis

- Tidak menjalankan tes, build, preview atau Apps Script deployment dalam batch ini, sesuai aturan pengguna (finishing di VS Code).
- Pemeriksaan whitespace git diff --check dilakukan saat jeda; tidak menggantikan tes.
- Checkpoint disimpan pada branch checkpoint, bukan main. Lanjutkan pekerjaan dari branch ini; integrasikan ke main setelah WIP selesai.
- Jangan gunakan reset/hard reset atau menimpa perubahan lain. Fetch/review status terlebih dahulu.

## Berkas masukan

RAR dibaca di /tmp/kontrakan-read, asal upload Downloads.rar. Terdapat 7 file: LPD terisi, Memo Kasbon terisi, Action Plan terisi, Data Kontrakan terisi, Permintaan Kontrakan terisi, template Perjanjian Sewa DOCX, scan perjanjian PDF. Berkas ini tidak dimasukkan repo dan belum diunggah ke Drive. Jangan menganggap lokasi /tmp persisten; bila hilang gunakan upload sediment file_00000000d5ec82119132da3c9d78f71a.

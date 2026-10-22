# Pusat kerja AI PT.UTP

Mulai dari file ini untuk semua tugas AI. Pemilik konteks dan integrasi: Codex. Maksimal dua pembuat kode aktif dan satu reviewer; maksimal dua tugas per AI per prompt.

## Source tunggal

- Source aplikasi: `../aplikasi/`.
- Test: `../pengujian/`.
- Kontrak backend Spek: `../kontrak-materialspec.md`.
- Template tetap LPD: `../template/lpd/TEMPLATE-LPD-PT-UTP.xlsx`.
- Aturan kerja repository: `../AGENTS.md`.
- Aturan bisnis Material: `ATURAN-MATERIAL.md`.
- Status serahan: `STATUS.md`.

Jangan menggandakan seluruh source ke folder ini. Source aktual adalah worktree repository; HEAD saja tidak mewakili perubahan lokal yang belum di-commit. Sebelum bekerja, catat commit dan perubahan lokal terkait. AI browser yang membaca GitHub hanya melihat versi yang sudah di-push, bukan worktree Codex.

## Akses

AI dengan akses repository membaca folder ini langsung. AI browser harus memiliki koneksi GitHub/penyimpanan atau kemampuan membuka URL file yang diberikan. Folder lokal ini tidak otomatis dapat dibaca ChatGPT, AI Studio, atau DeepSeek. Jangan mengklaim koneksi/sinkronisasi yang belum diuji. Jangan menjadikan repository publik hanya untuk mempermudah akses.

Jika koneksi langsung tidak tersedia, Codex memberi konteks relevan sebagai teks siap salin. Hindari meminta pengguna mengunduh dan mengunggah ZIP berulang. Lampiran hanya digunakan bila diperlukan dan disepakati.

## Serahan

AI tanpa akses tulis mengembalikan kode lengkap per file dalam blok siap salin; bukan path lokal, tautan localhost, elipsis, atau klaim attachment. Untuk file besar, kirim per file atau bagian bernomor dengan batas penyambungan jelas. Codex yang memasukkan hasil ke source.

AI dengan akses repo hanya mengubah cakupan yang ditugaskan. Jangan commit/push/deploy/clasp tanpa otorisasi. Hasil wajib memuat file berubah, bukti pemeriksaan aktual, dan keterbatasan. Jangan mengklaim suite lulus tanpa output aktual.

Serahan mentah disimpan lokal oleh Codex dalam `.ai-inbox/`. Itu arsip hasil yang belum dipercaya, bukan aturan baru atau source produksi.

## Format prompt tetap

```yaml
TASK: ID-TUGAS
MODE: implement
SOURCE: kerja-ai/README.md dan file relevan yang disebutkan
GOAL:
  task_1: Hasil terukur
  task_2: Pemeriksaan atau hasil kedua bila diperlukan
RULES: ID aturan relevan; sertakan isinya jika AI tidak dapat membaca repo
SCOPE:
  write: Daftar file/bagian milik AI
  forbid: Batas eksplisit
ACCEPTANCE: Perilaku yang harus terbukti
VERIFY: Pemeriksaan yang diotorisasi pada tugas ini
DELIVER: Kode aktual, bukti, kekurangan; siap salin jika tanpa akses repo
STOP_IF: Benturan source atau kebutuhan di luar cakupan
```

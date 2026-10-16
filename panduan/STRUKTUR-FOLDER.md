# Struktur folder proyek

Ditata 17 Oktober 2026. Tujuannya memisahkan sumber aktif, alat kerja, pratinjau, catatan, dan arsip. Nama fungsi serta nama file datar Apps Script tetap sama.

```text
UTP Memo Cloud App/
├── README.md                   ← pintu masuk
├── HANDOFF.md                  ← instruksi singkat melanjutkan
├── AGENTS.md                   ← aturan kerja AI
├── CONVERSATION.md             ← catatan percakapan awal
├── aplikasi/
│   ├── bersama/                ← halaman utama, login, Beranda, gaya, manifest
│   ├── material/               ← backend, aturan, dan frontend material
│   ├── memo/                   ← memo dan manpower
│   ├── rpb/                    ← Rencana Pengeluaran Bulanan
│   └── rpd/                    ← placeholder RPD
├── alat/                       ← build, preview, ekspor, dan pemeriksaan
├── pengujian/                  ← tes otomatis
├── pratinjau/
│   ├── aplikasi.html           ← hasil gabungan aplikasi untuk lokal
│   └── prototipe-material.html ← prototipe mandiri teruji
├── panduan/
│   ├── MULAI-DI-SINI.md        ← tujuan dan keputusan bisnis
│   ├── STATUS-BREAK.md         ← progres terbaru dan tugas berikutnya
│   ├── STRUKTUR-FOLDER.md      ← dokumen ini
│   ├── laporan/               ← bukti pekerjaan dan batasannya
│   ├── masukan-ai/             ← bahan dari AI eksternal, bukan aturan aktif
│   └── riwayat/                ← ekspor pesan user/asisten yang tersedia
├── data-referensi/             ← contoh master sintetis dan cara menyiapkan asli
├── arsip/                      ← kode/panduan lama, bukan sumber build
└── graphify-out/               ← peta hasil alat, tanpa rebuild saat penataan
```

## Menerjemahkan lokasi lama

| Lokasi lama | Lokasi sekarang |
| --- | --- |
| `memo/`, `rpb/`, `rpd/` | `aplikasi/memo/`, `aplikasi/rpb/`, `aplikasi/rpd/` |
| `shared/` | `aplikasi/bersama/` |
| `utp/` | `aplikasi/material/` |
| `tools/build_clasp_source.js` | `alat/buat-sumber-clasp.js` |
| `tools/build_local_preview.py` | `alat/buat-pratinjau.py` |
| `tools/build_code_graph.py` | `alat/peta-kode.py` |
| `tools/export_brainstorming.py` | `alat/ekspor-riwayat.py` |
| `tools/prepare_master_items.py` | `alat/siapkan-master-item.py` |
| `tools/check_material_frontend.cjs` | `alat/periksa-frontend-material.cjs` |
| `tools/check_material_prototype.cjs` | `alat/periksa-prototipe-material.cjs` |
| `tests/rpb-contract.test.js` | `pengujian/rpb-kontrak.test.js` |
| `tests/utp-domain.test.js` | `pengujian/material-domain.test.js` |
| `tests/utp-storage.test.js` | `pengujian/material-penyimpanan.test.js` |
| `preview/Index-demo-lokal.html` | `pratinjau/aplikasi.html` |
| `preview/material-prototype.html` | `pratinjau/prototipe-material.html` |
| `data/` | `data-referensi/` |
| Root Code.gs/Index/Client/Styles/appsscript/Index-demo-lokal | `arsip/kode-lama/versi-awal/` |
| `legacy/Client.html` | `arsip/kode-lama/versi-modular/Client.html` |
| README memo lama / HANDOFF lama | `arsip/panduan-lama/` |
| `panduan/laporan/BERANDA-RESULT.md` | `panduan/laporan/beranda-dan-login.md` |
| `panduan/laporan/RPB-RESULT.md` | `panduan/laporan/perbaikan-rpb.md` |
| `panduan/laporan/MATERIAL-BACKEND-RESULT.md` | `panduan/laporan/backend-material.md` |
| `panduan/laporan/MATERIAL-PROTOTYPE-RESULT.md` | `panduan/laporan/prototipe-material.md` |
| `CHATGPT-SKENARIO-MANUAL.md` di masukan-ai | `chatgpt-skenario-uji.md` |
| `GEMINI-WIREFRAME-MATERIAL.md` di masukan-ai | `gemini-rancangan-material.md` |
| `GEMINI-PROTOTIPE-ASLI.txt` di masukan-ai | `gemini-prototipe-asli.txt` |
| `data/master_items.sample.csv` | `data-referensi/contoh-master-item.csv` |

Riwayat percakapan, masukan AI dan laporan historis tetap boleh menyebut nama lama. Gunakan tabel ini; jangan mengubah sejarah percakapan agar tampak seolah lokasi baru sudah ada sebelumnya.

## Folder internal

`.clasp-src/` hasil build datar, `.local/` data/laporan privat, `.venv/` lingkungan Python, `.git/` riwayat Git, `.codex/` pengaturan alat. Cache Python diabaikan Git. Master asli tidak dipindahkan dari Downloads dan tidak diunggah ke repository.

Peta `code-graph.json` hanya disesuaikan lokasi sumbernya. Tidak diekstraksi ulang; file baru dan nomor baris setelah edit mungkin belum tercakup. Gunakan query terbatas dan cek sumber sebenarnya. Keluaran Graphify lama yang lain dipertahankan sebagai snapshot.

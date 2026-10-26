# DOKUMEN SERAHAN TEKNIS & INTEGRASI UNTUK CODEX
**Aplikasi:** UTP Project Memory (Pusat Memori Dokumen & Pengendalian Pekerjaan Proyek PT UTP)  
**Basis Source Repository:** `defeoni/botutpiqbal` (Branch aktif / working tree)  
**Target Hosting:** Cloudflare Pages & Cloudflare Workers (dengan Google Drive & Telegram Bot Webhook)  
**Tanggal Handover:** 26 Oktober 2026

---

## 1. Ringkasan Eksekutif & Keputusan Arsitektur

Arah produk lama yang berpusat pada form generator/editor manual telah dirombak total menjadi **UTP Project Memory**:
1. **Model "Kirim File, Bukan Isi Formulir":** Admin Proyek cukup mengunggah berkas asli (Word, Excel, PDF, Scan Tanda Tangan, Foto Bukti Nota).
2. **Ekstraksi Terstruktur:** Sistem membaca teks, mengekstrak nomor surat, tanggal, pihak yang ditunggu (PM/MK/HO/Owner), tenggat, dan fakta terstruktur (misal rincian penambahan manpower).
3. **Penyatuan Identitas Dokumen (Single Memory Identity):** Berkas asli, draf revisi, scan basah bertanda tangan, dan surat balasan disatukan dalam satu identitas rekam dokumen—tidak lagi terpecah menjadi kartu terpisah.
4. **Meja Kanban Minimal (Aktif, Menunggu, Selesai):** Hanya berkas yang memicu pekerjaan/tindak lanjut yang masuk ke Kanban. Dokumen referensi standar (SOP K3, Pedoman Material) disimpan di Pusat Memori tanpa mengotori Kanban.
5. **Integritas Bisnis:** Pemindahan kartu ke status "Selesai" dicatat sebagai penyelesaian administratif, **bukan** approval otomatis jika paraf/tanda tangan belum tercantum pada berkas fisik.
6. **Penyimpanan Berkas Asli:** Google Drive tetap menjadi repositori berkas asli (`/PT UTP/[KodeProyek]/[Kategori]/`).

---

## 2. Arsitektur Komponen & Struktur Source Code

Aplikasi dibangun dengan stack modern, ringan, dan zero-dependency bloat:
- **Framework:** React 18 SPA + Vite 6 + TypeScript 5
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`), font *Plus Jakarta Sans* & *JetBrains Mono* (angka tabular).
- **Struktur Direktori:**
  ```text
  /
  ├── package.json              # Definisi scripts, react, tailwind, lucide-react
  ├── vite.config.ts            # Konfigurasi Vite + React + Tailwind v4 port 3000
  ├── tsconfig.json             # Konfigurasi TypeScript ketat
  ├── metadata.json             # Metadata aplikasi AI Studio
  ├── SERAHAN-CODEX.md          # Dokumen serahan ini
  ├── src/
  │   ├── types/
  │   │   └── index.ts          # Kontrak antarmuka data (DocumentRecord, ProjectInfo, Fact, dll)
  │   ├── services/
  │   │   ├── storageService.ts # Layanan penyimpanan persisten + query memori spesifik
  │   │   ├── parserService.ts  # Mesin ekstraksi konten berkas & deteksi relasi
  │   │   └── mockFiles.ts      # Data awal realistis proyek PT UTP (Bandung, Cikarang, IKN, HO)
  │   ├── components/
  │   │   ├── Header.tsx        # Top Bar Contract 3 zona + Ruang Proyek Toolbar
  │   │   ├── KanbanBoard.tsx   # Papan kerja 3 kolom (Aktif, Menunggu, Selesai)
  │   │   ├── DocumentDetail.tsx# Drawer slide-over memori, fakta, berkas, draf WA & audit trail
  │   │   ├── UploadModal.tsx   # Modal multi-file drag-drop & pratinjau hasil ekstraksi
  │   │   ├── MemoryExplorer.tsx# Tabel pusat memori, filter kategori, arsip & pulihkan
  │   │   ├── SearchPanel.tsx   # Pencarian fleksibel multi-kata & pertanyaan kunci instan
  │   │   ├── TelegramSimulator.tsx # Simulator bot Telegram berbasis tombol inline
  │   │   └── CodexHandoverModal.tsx # Pratinjau dokumentasi serahan di UI
  │   ├── App.tsx               # State router dan koordinator utama
  │   ├── main.tsx              # Mounting React ke DOM
  │   └── index.css             # Import Tailwind CSS v4 & styling scrollbar halus
  ├── aplikasi/                 # [DIPERTAHANKAN] File sumber legacy Apps Script
  ├── alat/                     # [DIPERTAHANKAN] Skrip tooling legacy
  └── pengujian/                # [DIPERTAHANKAN] Unit test suite legacy
  ```

---

## 3. Kontrak Data (TypeScript Types)

Semua entitas data didefinisikan dalam `src/types/index.ts`:

### A. DocumentRecord
```typescript
export interface DocumentRecord {
  id: string;                          // Format: 'DOC-[PROJ]-[TIMESTAMP]'
  projectId: ProjectId;                // 'PRJ-BDG' | 'PRJ-CKR' | 'PRJ-IKN' | 'PRJ-HO'
  title: string;                       // Judul perihal dokumen
  documentNumber: string;              // Nomor surat/memo resmi
  documentDate: string;                // YYYY-MM-DD
  category: DocumentCategory;          // MEMO_MANPOWER, SURAT_KORESPONDENSI, dll.
  isActionable: boolean;               // true: tampil di Kanban; false: memori referensi
  kanbanStatus: 'AKTIF' | 'MENUNGGU' | 'SELESAI';
  waitingParty: 'PM' | 'MK' | 'HO_DIREKSI' | 'OWNER' | 'VENDOR' | 'INTERNAL_ADMIN' | 'NONE';
  waitingPersonName?: string;
  requiredApproval?: string;
  deadline?: string;                   // YYYY-MM-DD
  followUpDate?: string;
  summary: string;
  nextAction: string;
  manpowerDetails?: {                  // Khusus dokumen jenis manpower
    changeType: 'PENAMBAHAN' | 'PENGURANGAN' | 'PERPINDAHAN';
    personnelNames: string[];
    position: string;
    headcount: number;
    placementLocation: string;
    effectiveDate: string;
    applicant: string;
    approver: string;
    decisionMentioned: string;
    actionRequired: string;
  };
  facts: StructuredFact[];             // Array fakta terstruktur dengan pembeda sumber
  files: DocumentFileAttachment[];     // Berkas asli, revisi, scan basah, lampiran
  relations: DocumentRelation[];       // Relasi surat masuk-keluar / balasan
  activityLog: ActivityLogEntry[];     // Audit trail
  isArchived: boolean;
}
```

### B. Tri-State Pembeda Fakta (Anti-Halusinasi)
```typescript
export type FactSourceType = 
  | 'DOKUMEN_FAKTA'   // Benar-benar tertulis dalam berkas
  | 'DUGAAN_SISTEM'   // Dihitung/ditebak oleh parser
  | 'KOREKSI_USER';   // Dimasukkan atau diperbaiki langsung oleh Admin
```

---

## 4. Cara Menjalankan, Menguji, dan Membangun

### Jalankan Development Server Lokal:
```bash
npm install
npm run dev
# Server aktif di http://localhost:3000
```

### Uji Build & Typecheck:
```bash
npm run build
# Menghasilkan folder dist/ yang siap dideploy ke server static mana pun
```

---

## 5. Penerapan ke Cloudflare (Cloudflare Pages & Workers)

Cloudflare adalah target hosting yang ideal karena memiliki free tier yang sangat murah hati:
- **Bandwidth:** Tidak terbatas gratis di Cloudflare Pages.
- **Workers:** 100.000 requests/hari gratis.
- **D1 Database (SQL):** 5 Juta read queries/hari dan 100.000 write queries/hari gratis.

### Opsi A: Deployment Langsung via Cloudflare Pages (Static SPA + LocalStorage/Drive)
1. Sambungkan repositori GitHub `defeoni/botutpiqbal` ke Cloudflare Pages Dashboard.
2. Pengaturan Build:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Build Output Directory:** `dist`
   - **Node.js Version:** `20` atau `22`
3. Atau via terminal menggunakan Wrangler CLI:
   ```bash
   npx wrangler pages deploy dist --project-name utp-project-memory
   ```

### Opsi B: Backend Cloudflare Workers + D1 (Untuk Sinkronisasi Multi-Pengguna)
Skema SQL telah disiapkan di `CodexHandoverModal.tsx`.
Untuk membuat database D1 di Cloudflare:
```bash
# Buat database
npx wrangler d1 create utp-project-memory-db

# Eksekusi migrasi skema SQL
npx wrangler d1 execute utp-project-memory-db --file=./schema.sql
```

---

## 6. Status Integrasi Layanan Eksternal

| Layanan | Status Saat Ini | Tindakan Lanjutan untuk Codex |
|---|---|---|
| **Google Drive Storage** | Penyimpanan lokal tersimulasi dengan referensi path `/PT UTP/...` | Pasang Google Service Account atau OAuth Client ID pada Worker untuk upload stream biner langsung ke folder Drive. |
| **Telegram Bot (@UTPProjectBot)** | Simulator interaktif inline-keyboard di web | Pasang webhook Cloudflare Worker ke `https://api.telegram.org/bot<TOKEN>/setWebhook` mengarah ke worker endpoint `/api/telegram`. Token bot disimpan di Cloudflare Secrets (`wrangler secret put TELEGRAM_BOT_TOKEN`). |
| **WhatsApp Reminder** | Generator draf teks satu-klik siap salin ke clipboard | Pertahankan pengiriman manual via klik admin untuk menghindari spam otomatis pihak ketiga. |
| **AI Document Extraction** | Parser heuristik terstruktur bawaan (cepat, deterministik, tanpa biaya API) | Dapat disambungkan ke Gemini 2.5/Flash bila ingin OCR scan foto beresolusi tinggi dengan API key tersimpan di backend proxy. |

---

## 7. Pekerjaan Lanjutan Prioritas untuk Codex

1. **Sinkronisasi Git:** Pull source terbaru ke branch `main`, lakukan commit bersih dengan pesan `feat: rebuild UTP Project Memory interface & core architecture`.
2. **Setup Cloudflare Pages:** Buat project Pages pada Cloudflare dashboard pengguna dan lakukan deployment pertama.
3. **Konfigurasi Secret Telegram:** Masukkan token Telegram Bot ke Cloudflare Worker jika bot Telegram fisik ingin diaktifkan.
4. **Verifikasi Jalur Legacy:** Pastikan folder `aplikasi/` dan `pengujian/` tetap tersimpan dengan aman di repositori.

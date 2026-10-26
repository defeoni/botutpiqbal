import React, { useState } from 'react';
import { 
  FileText, 
  Terminal, 
  Cloud, 
  CheckCircle2, 
  Copy, 
  Check, 
  Database, 
  Send, 
  HardDrive,
  ShieldCheck
} from 'lucide-react';

export const CodexHandoverModal: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(id);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const cfDeployScript = `# 1. Instalasi dependensi
npm install

# 2. Pengujian linting & TypeScript build
npm run build

# 3. Deployment ke Cloudflare Pages
npx wrangler pages deploy dist --project-name utp-project-memory`;

  const d1SchemaSql = `-- Cloudflare D1 SQL Schema untuk UTP Project Memory
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  pm_name TEXT,
  mk_name TEXT,
  owner_name TEXT,
  urgency TEXT DEFAULT 'NORMAL',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_records (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  document_number TEXT,
  document_date TEXT,
  category TEXT NOT NULL,
  is_actionable INTEGER DEFAULT 1,
  kanban_status TEXT DEFAULT 'AKTIF', -- 'AKTIF' | 'MENUNGGU' | 'SELESAI'
  waiting_party TEXT,
  waiting_person_name TEXT,
  required_approval TEXT,
  deadline TEXT,
  follow_up_date TEXT,
  summary TEXT,
  next_action TEXT,
  is_archived INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS document_files (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  file_type TEXT,
  file_role TEXT NOT NULL, -- 'ASLI' | 'REVISI' | 'SCAN_BASAH' | 'LAMPIRAN' | 'SURAT_BALASAN'
  storage_location TEXT NOT NULL,
  drive_file_id TEXT,
  uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (document_id) REFERENCES document_records(id)
);

CREATE TABLE IF NOT EXISTS document_facts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  fact_key TEXT NOT NULL,
  fact_label TEXT NOT NULL,
  fact_value TEXT NOT NULL,
  source_type TEXT NOT NULL, -- 'DOKUMEN_FAKTA' | 'DUGAAN_SISTEM' | 'KOREKSI_USER'
  FOREIGN KEY (document_id) REFERENCES document_records(id)
);`;

  return (
    <div className="max-w-4xl mx-auto space-y-5 text-xs">
      {/* Header Banner */}
      <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-100">
                Serahan Arsitektur & Panduan Integrasi untuk Rekan Codex
              </h2>
              <p className="text-[11px] text-slate-400">
                Dokumen kontrak teknis, arsitektur data, petunjuk deployment Cloudflare, dan batasan layanan.
              </p>
            </div>
          </div>
          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-300 border border-blue-500/30">
            HANDOVER READY
          </span>
        </div>
      </div>

      {/* Grid of Key Architecture Points */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Cloud className="w-4 h-4 text-amber-400" />
            <span>1. Target Platform: Cloudflare</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Aplikasi dirancang sebagai <strong>Vite React SPA</strong> berkinerja tinggi, kompatibel penuh dengan <strong>Cloudflare Pages</strong> (gratis tier tanpa batas bandwidth). Untuk backend API dinamis, dapat disambungkan ke <strong>Cloudflare Workers + D1 (SQL)</strong> atau mode static SPA dengan Google Drive REST.
          </p>
        </div>

        <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <HardDrive className="w-4 h-4 text-emerald-400" />
            <span>2. Penyimpanan Berkas: Google Drive</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            File asli disimpan di <strong>Google Drive</strong> proyek yang sudah ada. Struktur path: <code className="text-amber-300 font-mono">/PT UTP/[KodeProyek]/[Kategori]/</code>. Dokumen hanya dibaca dan dipetakan; berkas asli tidak pernah ditimpa.
          </p>
        </div>

        <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Database className="w-4 h-4 text-blue-400" />
            <span>3. Integritas Data & Anti-Pill Discipline</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Membedakan secara tegas: <strong>DOKUMEN_FAKTA</strong> (teks asli), <strong>DUGAAN_SISTEM</strong> (inferensi), dan <strong>KOREKSI_USER</strong>. Status Selesai di Kanban bersifat administratif dan tidak merekayasa paraf approval.
          </p>
        </div>

        <div className="p-3.5 bg-slate-900/60 rounded-lg border border-slate-800 space-y-2">
          <div className="flex items-center gap-2 text-slate-200 font-semibold">
            <Send className="w-4 h-4 text-rose-400" />
            <span>4. Integrasi Bot Telegram & Draf WA</span>
          </div>
          <p className="text-slate-300 leading-relaxed text-[11px]">
            Webhook Telegram bot menerima berkas via inline buttons. Khusus nota, pemilihan folder (Nota/Keuangan vs Arsip Foto) dilakukan atas pilihan admin, bukan tebakan AI. Draf WhatsApp siap salin untuk pengiriman manual yang aman.
          </p>
        </div>
      </div>

      {/* Cloudflare Pages Deployment Snippet */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-amber-400" />
            <span>Perintah Build & Deploy ke Cloudflare Pages</span>
          </span>
          <button
            onClick={() => handleCopy(cfDeployScript, 'cf')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
          >
            {copiedSection === 'cf' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Salin Skrip</span>
          </button>
        </div>
        <pre className="p-3 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto">
          {cfDeployScript}
        </pre>
      </div>

      {/* D1 SQL Schema Snippet */}
      <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-slate-200 flex items-center gap-1.5">
            <Database className="w-4 h-4 text-blue-400" />
            <span>Skema Relasional Cloudflare D1 (Bila Menggunakan Database Cloudflare)</span>
          </span>
          <button
            onClick={() => handleCopy(d1SchemaSql, 'd1')}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] flex items-center gap-1 transition-colors"
          >
            {copiedSection === 'd1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
            <span>Salin Skema D1</span>
          </button>
        </div>
        <pre className="p-3 bg-slate-900 rounded font-mono text-[11px] text-slate-300 overflow-x-auto max-h-48">
          {d1SchemaSql}
        </pre>
      </div>

      {/* Checklist Serahan untuk Codex */}
      <div className="p-4 bg-slate-900/70 border border-slate-800 rounded-lg space-y-2">
        <h3 className="font-semibold text-slate-200 flex items-center gap-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Langkah Lanjutan Penting untuk Codex:</span>
        </h3>
        <ul className="space-y-1.5 text-slate-300 text-[11px] list-disc list-inside">
          <li><strong>Konfigurasi Cloudflare Pages:</strong> Buat project Pages pada akun Cloudflare dengan build command <code className="text-amber-300 font-mono">npm run build</code> dan output directory <code className="text-amber-300 font-mono">dist</code>.</li>
          <li><strong>Penyimpanan Google Drive:</strong> Hubungkan Service Account Google Drive atau OAuth2 Client ID milik PT UTP ke proxy Workers untuk upload/download binary berkas asli.</li>
          <li><strong>Telegram Webhook:</strong> Arahkan webhook bot Telegram ke endpoint Worker <code className="text-amber-300 font-mono">/api/telegram/webhook</code> dengan token tersimpan di Cloudflare Secrets (bukan hardcoded).</li>
          <li><strong>Verifikasi Integritas:</strong> Tidak ada file legacy yang dihapus; aplikasi lama di <code className="text-slate-400 font-mono">aplikasi/</code> tetap utuh sebagai cadangan.</li>
        </ul>
      </div>
    </div>
  );
};

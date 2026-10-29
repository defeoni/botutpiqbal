import React, { useState } from 'react';
import { DocumentCategory, DocumentRecord, ProjectId } from '../types';
import { 
  Layers, 
  FileText, 
  Paperclip, 
  Archive, 
  RotateCcw, 
  Search, 
  Filter, 
  FileCheck,
  Building2,
  Calendar,
  CheckCircle,
  Clock
} from 'lucide-react';

interface MemoryExplorerProps {
  documents: DocumentRecord[];
  allDocumentsIncludingArchived: DocumentRecord[];
  selectedProjectId: ProjectId;
  onOpenDocument: (doc: DocumentRecord) => void;
  onToggleArchive: (docId: string) => void;
}

export const MemoryExplorer: React.FC<MemoryExplorerProps> = ({
  documents,
  allDocumentsIncludingArchived,
  selectedProjectId,
  onOpenDocument,
  onToggleArchive,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [viewScope, setViewScope] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');

  const displayedList = viewScope === 'ACTIVE' 
    ? documents 
    : allDocumentsIncludingArchived.filter(d => d.isArchived);

  const filteredDocs = displayedList.filter(doc => {
    // Category filter
    if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
      return false;
    }

    // Text search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = doc.title.toLowerCase().includes(q);
      const matchNum = doc.documentNumber.toLowerCase().includes(q);
      const matchSummary = doc.summary.toLowerCase().includes(q);
      const matchFiles = doc.files.some(f => f.fileName.toLowerCase().includes(q));
      const matchFacts = doc.facts.some(f => f.value.toLowerCase().includes(q));
      if (!matchTitle && !matchNum && !matchSummary && !matchFiles && !matchFacts) {
        return false;
      }
    }

    return true;
  });

  const categories: { key: string; label: string }[] = [
    { key: 'ALL', label: 'Semua Kategori' },
    { key: 'MEMO_MANPOWER', label: 'Memo Manpower' },
    { key: 'SURAT_KORESPONDENSI', label: 'Surat & Balasan' },
    { key: 'APPROVAL_SPEK', label: 'Approval Spek & MK' },
    { key: 'RPB_MATERIAL', label: 'RPB & Pengadaan' },
    { key: 'RPD_KEUANGAN', label: 'RPD & Kasbon' },
    { key: 'KONTRAK_SEWA', label: 'Kontrak & Sewa' },
    { key: 'REFERENSI_STANDAR', label: 'Pedoman / SOP Umum' },
  ];

  return (
    <div className="space-y-4">
      {/* Header and Scope Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-400" />
            <span>Pusat Memori Dokumen Proyek</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Menyimpan rekam dokumen, fakta terstruktur, berkas asli, dan referensi standar PT UTP tanpa batasan meja kerja.
          </p>
        </div>

        {/* Active vs Archived segmented button */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-md border border-slate-800">
          <button
            onClick={() => setViewScope('ACTIVE')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
              viewScope === 'ACTIVE'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Dokumen Aktif & Referensi
          </button>
          <button
            onClick={() => setViewScope('ARCHIVED')}
            className={`px-3 py-1 text-xs font-medium rounded transition-colors flex items-center gap-1.5 ${
              viewScope === 'ARCHIVED'
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Archive className="w-3 h-3 text-amber-400" />
            <span>Arsip ({allDocumentsIncludingArchived.filter(d => d.isArchived).length})</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row md:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Cari perihal, nomor surat, nama file asli, pihak terkait, atau fakta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 text-slate-100 border border-slate-800 rounded-md pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:border-amber-400/80"
          />
        </div>

        {/* Category filter pills (interactive button controls) */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
          {categories.map(c => (
            <button
              key={c.key}
              onClick={() => setSelectedCategory(c.key)}
              className={`px-2.5 py-1 text-xs rounded transition-colors whitespace-nowrap shrink-0 border ${
                selectedCategory === c.key
                  ? 'bg-amber-400/10 text-amber-300 border-amber-500/40 font-medium'
                  : 'bg-slate-900/60 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Memory Documents Table / List */}
      <div className="bg-slate-900/50 rounded-lg border border-slate-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Proyek & No. Dokumen</th>
                <th className="py-2.5 px-3">Perihal / Judul Memori</th>
                <th className="py-2.5 px-3">Kategori</th>
                <th className="py-2.5 px-3">Status & Pihak Ditunggu</th>
                <th className="py-2.5 px-3">Berkas & Bukti</th>
                <th className="py-2.5 px-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500 text-xs">
                    Tidak ditemukan dokumen memori yang sesuai dengan filter.
                  </td>
                </tr>
              ) : (
                filteredDocs.map(doc => {
                  const hasScan = doc.files.some(f => f.fileRole === 'SCAN_BASAH');

                  return (
                    <tr 
                      key={doc.id}
                      onClick={() => onOpenDocument(doc)}
                      className="hover:bg-slate-850/60 cursor-pointer transition-colors group"
                    >
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="font-mono text-amber-400 font-medium text-[11px]">
                          {doc.projectId}
                        </div>
                        <div className="font-mono text-slate-400 text-[11px] truncate max-w-[140px]">
                          {doc.documentNumber}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 max-w-[320px]">
                        <strong className="text-slate-100 font-medium group-hover:text-amber-200 transition-colors block truncate">
                          {doc.title}
                        </strong>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">
                          {doc.summary}
                        </p>
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                        {doc.category.replace('_', ' ')}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className={`font-semibold text-[11px] ${
                            doc.kanbanStatus === 'AKTIF'
                              ? 'text-blue-400'
                              : doc.kanbanStatus === 'MENUNGGU'
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}>
                            {doc.kanbanStatus}
                          </span>
                          {doc.waitingParty !== 'NONE' && (
                            <>
                              <span aria-hidden="true" className="text-slate-600">·</span>
                              <span className="text-slate-300 text-[11px] truncate max-w-[120px]">
                                {doc.waitingPersonName || doc.waitingParty}
                              </span>
                            </>
                          )}
                        </div>
                        {doc.deadline && (
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Tenggat: {doc.deadline}
                          </div>
                        )}
                      </td>

                      <td className="py-2.5 px-3 whitespace-nowrap text-slate-400 text-[11px]">
                        <div className="flex items-center gap-1.5">
                          <Paperclip className="w-3 h-3 text-slate-400" />
                          <span className="font-mono">{doc.files.length}</span>
                          {hasScan && (
                            <span className="text-emerald-400 font-medium flex items-center gap-0.5 text-[10px]">
                              <FileCheck className="w-3 h-3" />
                              <span>Scan Basah</span>
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onToggleArchive(doc.id)}
                          title={doc.isArchived ? "Pulihkan ke Meja Kerja" : "Arsipkan Dokumen"}
                          className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 transition-colors inline-flex items-center gap-1"
                        >
                          {doc.isArchived ? (
                            <>
                              <RotateCcw className="w-3 h-3 text-emerald-400" />
                              <span>Pulihkan</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3 h-3 text-slate-400" />
                              <span>Arsip</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

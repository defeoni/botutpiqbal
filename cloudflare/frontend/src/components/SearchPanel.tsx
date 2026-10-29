import React, { useState, useEffect } from 'react';
import { DocumentRecord, ProjectId } from '../types';
import { 
  Search, 
  Sparkles, 
  FileText, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ArrowRight,
  Filter,
  FileCheck
} from 'lucide-react';

interface SearchPanelProps {
  documents: DocumentRecord[];
  initialQuery?: string;
  onOpenDocument: (doc: DocumentRecord) => void;
}

export const SearchPanel: React.FC<SearchPanelProps> = ({
  documents,
  initialQuery = '',
  onOpenDocument,
}) => {
  const [query, setQuery] = useState(initialQuery);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  useEffect(() => {
    if (initialQuery) {
      setQuery(initialQuery);
    }
  }, [initialQuery]);

  // Quick preset questions from prompt
  const presets = [
    {
      label: 'Memo Manpower Menunggu',
      q: 'manpower menunggu',
      category: 'MEMO_MANPOWER'
    },
    {
      label: 'Dokumen di Meja PM',
      q: 'PM Bambang',
      category: 'ALL'
    },
    {
      label: 'Tindak Lanjut Minggu Ini',
      q: '2026',
      category: 'ALL'
    },
    {
      label: 'Surat Belum Ada Balasan',
      q: 'surat belum balasan',
      category: 'SURAT_KORESPONDENSI'
    },
    {
      label: 'Scan Bertanda Tangan Basah',
      q: 'scan basah signed',
      category: 'ALL'
    },
    {
      label: 'Berkas Proyek Bandung',
      q: 'Bandung PRJ-BDG',
      category: 'ALL'
    },
    {
      label: 'Approval Merek & Spek Pipa/Beton',
      q: 'wavin holcim approval',
      category: 'APPROVAL_SPEK'
    }
  ];

  // Flexible multi-word substring match
  const filteredResults = documents.filter(doc => {
    if (selectedCategory !== 'ALL' && doc.category !== selectedCategory) {
      return false;
    }

    if (!query.trim()) return true;

    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);

    // Search target surface
    const targetString = [
      doc.title,
      doc.documentNumber,
      doc.documentDate,
      doc.projectId,
      doc.category,
      doc.summary,
      doc.nextAction,
      doc.waitingPersonName || '',
      doc.waitingParty,
      doc.requiredApproval || '',
      doc.deadline || '',
      ...doc.files.map(f => `${f.fileName} ${f.storageLocation} ${f.textSnippet || ''}`),
      ...doc.facts.map(fact => `${fact.label} ${fact.value}`)
    ].join(' ').toLowerCase();

    // Flexible match: all terms must match (or substring match)
    return terms.every(term => targetString.includes(term));
  });

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 space-y-3">
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-amber-400" />
            <span>Pencarian Memori Dokumen Terstruktur</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Mencari di seluruh judul, nama asli berkas, teks ekstrak, nomor surat, pihak yang ditunggu, tenggat, dan fakta spesifik.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ketik pencarian: 'manpower', 'wavin', 'ir bambang', 'scan basah', 'sewa cikarang'..."
            className="w-full bg-slate-950 text-slate-100 border border-slate-700/80 rounded-lg pl-10 pr-4 py-2 text-xs focus:outline-none focus:border-amber-400 font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-2.5 text-xs text-slate-400 hover:text-white"
            >
              Bersihkan
            </button>
          )}
        </div>

        {/* Preset Query Buttons */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Pertanyaan Kunci Admin:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {presets.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setQuery(preset.q);
                  setSelectedCategory(preset.category);
                }}
                className={`text-[11px] px-2.5 py-1 rounded transition-colors border ${
                  query === preset.q
                    ? 'bg-amber-400/20 text-amber-300 border-amber-500/50 font-medium'
                    : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1">
        <span>Menampilkan <strong className="text-slate-200">{filteredResults.length}</strong> hasil pencarian</span>
        {query && (
          <span className="font-mono text-[11px]">Kata kunci: "{query}"</span>
        )}
      </div>

      {/* Results List */}
      <div className="space-y-2.5">
        {filteredResults.length === 0 ? (
          <div className="bg-slate-900/30 border border-dashed border-slate-800 rounded-lg p-8 text-center text-xs text-slate-500">
            <p>Tidak ada dokumen yang cocok dengan kata kunci "{query}".</p>
            <p className="text-[11px] text-slate-600 mt-1">Coba gunakan sebagian kata atau pilih salah satu Pertanyaan Kunci di atas.</p>
          </div>
        ) : (
          filteredResults.map(doc => {
            const hasScan = doc.files.some(f => f.fileRole === 'SCAN_BASAH');

            return (
              <div
                key={doc.id}
                onClick={() => onOpenDocument(doc)}
                className="p-3.5 bg-slate-900/70 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition-all space-y-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-amber-400 font-semibold">{doc.projectId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{doc.documentNumber}</span>
                      <span aria-hidden="true">·</span>
                      <span>{doc.documentDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>{doc.category.replace('_', ' ')}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-slate-100 hover:text-amber-200 transition-colors">
                      {doc.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-semibold ${
                      doc.kanbanStatus === 'AKTIF'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : doc.kanbanStatus === 'MENUNGGU'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    }`}>
                      {doc.kanbanStatus}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed">
                  {doc.summary}
                </p>

                {/* Facts snippet matching search */}
                <div className="flex flex-wrap gap-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                  {doc.waitingParty !== 'NONE' && (
                    <div className="flex items-center gap-1">
                      <span>Menunggu:</span>
                      <strong className="text-slate-200">{doc.waitingPersonName || doc.waitingParty}</strong>
                    </div>
                  )}

                  {doc.deadline && (
                    <div className="flex items-center gap-1 text-amber-300/90 font-mono">
                      <span>Tenggat:</span>
                      <span>{doc.deadline}</span>
                    </div>
                  )}

                  <div className="flex items-center gap-1 ml-auto">
                    <Paperclip className="w-3 h-3 text-slate-400" />
                    <span>{doc.files.length} berkas</span>
                    {hasScan && (
                      <span className="text-emerald-400 font-medium ml-1 flex items-center gap-0.5">
                        <FileCheck className="w-3 h-3" />
                        <span>Scan Basah Ada</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

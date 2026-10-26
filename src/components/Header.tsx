import React from 'react';
import { ProjectId, ProjectInfo } from '../types';
import { 
  FolderKanban, 
  Layers, 
  Search, 
  Send, 
  FileText, 
  Upload, 
  ChevronDown,
  Building2,
  Clock,
  Sparkles
} from 'lucide-react';

interface HeaderProps {
  currentView: 'KANBAN' | 'MEMORY' | 'SEARCH' | 'TELEGRAM' | 'CODEX';
  onSelectView: (view: 'KANBAN' | 'MEMORY' | 'SEARCH' | 'TELEGRAM' | 'CODEX') => void;
  projects: ProjectInfo[];
  selectedProjectId: ProjectId;
  onSelectProject: (id: ProjectId) => void;
  onOpenUpload: () => void;
  onTriggerQuickQuestion: (queryType: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentView,
  onSelectView,
  projects,
  selectedProjectId,
  onSelectProject,
  onOpenUpload,
  onTriggerQuickQuestion,
}) => {
  const currentProject = projects.find(p => p.id === selectedProjectId);

  return (
    <header className="sticky top-0 z-30 bg-slate-950/95 backdrop-blur-md border-b border-slate-800/80">
      {/* Zone 1, 2, 3: Top Bar Contract */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 gap-8">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-sm tracking-wider">
              UTP
            </div>
            <a 
              href="#" 
              onClick={(e) => { e.preventDefault(); onSelectView('KANBAN'); }}
              className="text-base font-bold tracking-tight text-slate-100 hover:text-white whitespace-nowrap shrink-0"
            >
              UTP Project Memory
            </a>
          </div>

          {/* Zone 2: Concise Nav Links (4-5 single-line items) */}
          <nav className="hidden md:flex items-center gap-1 shrink-0">
            <button
              onClick={() => onSelectView('KANBAN')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentView === 'KANBAN'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              <span>Meja Kanban</span>
            </button>

            <button
              onClick={() => onSelectView('MEMORY')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentView === 'MEMORY'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Pusat Memori</span>
            </button>

            <button
              onClick={() => onSelectView('SEARCH')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentView === 'SEARCH'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
              <span>Cari & Temukan</span>
            </button>

            <button
              onClick={() => onSelectView('TELEGRAM')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentView === 'TELEGRAM'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Bot Telegram</span>
            </button>

            <button
              onClick={() => onSelectView('CODEX')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                currentView === 'CODEX'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Serahan Codex</span>
            </button>
          </nav>

          {/* Zone 3: Primary Action CTA */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={onOpenUpload}
              className="px-3.5 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 rounded shadow-xs transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Berkas</span>
            </button>
          </div>
        </div>
      </div>

      {/* Workspace Context Toolbar: Project Scope & Quick Memory Triggers */}
      <div className="bg-slate-900/90 border-t border-slate-800/60 px-4 sm:px-6 lg:px-8 py-2">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-2.5 text-xs">
          {/* Project Picker Lockup */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Building2 className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-400">Ruang Proyek:</span>
            </div>

            <div className="relative">
              <select
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value as ProjectId)}
                aria-label="Pilih Proyek Aktif"
                className="appearance-none bg-slate-950 text-slate-100 border border-slate-700/80 rounded py-1 pl-2.5 pr-8 text-xs font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                <option value="ALL">Semua Proyek (Konsolidasi PT UTP)</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} [{p.code}]
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2 top-2 pointer-events-none" />
            </div>

            {currentProject && (
              <div className="hidden sm:flex items-center gap-2 text-slate-400">
                <span aria-hidden="true">·</span>
                <span>PM: <strong className="text-slate-200 font-medium">{currentProject.pmName}</strong></span>
                <span aria-hidden="true">·</span>
                <span>MK: <span className="text-slate-300">{currentProject.mkName}</span></span>
                <span aria-hidden="true">·</span>
                <span className={`font-mono text-[11px] px-1.5 py-0.2 rounded border ${
                  currentProject.urgency === 'TINGGI'
                    ? 'border-rose-500/30 text-rose-300 bg-rose-500/10'
                    : currentProject.urgency === 'SEDANG'
                    ? 'border-amber-500/30 text-amber-300 bg-amber-500/10'
                    : 'border-slate-700 text-slate-400 bg-slate-800/40'
                }`}>
                  URGENSI {currentProject.urgency}
                </span>
              </div>
            )}
          </div>

          {/* Quick Memory Query Shortcuts - Solves prompt core questions in 1-click */}
          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 no-scrollbar">
            <span className="text-slate-400 shrink-0 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Memori Cepat:</span>
            </span>
            <button
              onClick={() => onTriggerQuickQuestion('MANPOWER_MENUNGGU')}
              className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded px-2 py-0.5 whitespace-nowrap shrink-0 transition-colors"
            >
              Memo Manpower Menunggu
            </button>
            <button
              onClick={() => onTriggerQuickQuestion('DI_MEJA_PM')}
              className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded px-2 py-0.5 whitespace-nowrap shrink-0 transition-colors"
            >
              Dokumen di PM
            </button>
            <button
              onClick={() => onTriggerQuickQuestion('DEADLINE_MINGGU_INI')}
              className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded px-2 py-0.5 whitespace-nowrap shrink-0 transition-colors"
            >
              Tenggat Minggu Ini
            </button>
            <button
              onClick={() => onTriggerQuickQuestion('BELUM_ADA_BALASAN')}
              className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded px-2 py-0.5 whitespace-nowrap shrink-0 transition-colors"
            >
              Surat Belum Dibalas
            </button>
            <button
              onClick={() => onTriggerQuickQuestion('SCAN_BASAH')}
              className="text-[11px] text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 rounded px-2 py-0.5 whitespace-nowrap shrink-0 transition-colors"
            >
              Scan Tanda Tangan
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

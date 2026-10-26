import { ArrowUpRight, Building2, ChevronDown, FileText, FolderKanban, Layers, Search, Send } from 'lucide-react';
import { ProjectId, ProjectInfo } from '../types';

interface HeaderProps {
  currentView: 'KANBAN' | 'MEMORY' | 'SEARCH' | 'TELEGRAM' | 'CODEX';
  onSelectView: (view: 'KANBAN' | 'MEMORY' | 'SEARCH' | 'TELEGRAM' | 'CODEX') => void;
  projects: ProjectInfo[];
  selectedProjectId: ProjectId;
  onSelectProject: (id: ProjectId) => void;
  onOpenUpload: () => void;
  onTriggerQuickQuestion: (queryType: string) => void;
}

const navigation = [
  { view: 'KANBAN', title: 'Meja kerja', icon: FolderKanban },
  { view: 'MEMORY', title: 'Pusat memori', icon: Layers },
  { view: 'SEARCH', title: 'Pencarian', icon: Search },
  { view: 'TELEGRAM', title: 'Telegram', icon: Send },
] as const;

const shortcuts = [
  ['MANPOWER_MENUNGGU', 'Manpower'],
  ['DI_MEJA_PM', 'Dokumen di PM'],
  ['DEADLINE_MINGGU_INI', 'Tenggat'],
  ['BELUM_ADA_BALASAN', 'Belum dibalas'],
  ['SCAN_BASAH', 'Scan tanda tangan'],
];

export function Header({ currentView, onSelectView, projects, selectedProjectId, onSelectProject, onOpenUpload, onTriggerQuickQuestion }: HeaderProps) {
  return (
    <header className="workspace-header">
      <div className="header-main workspace-width">
        <a href="#" className="workspace-brand" onClick={e => { e.preventDefault(); onSelectView('KANBAN'); }}>
          <span className="brand-symbol" aria-hidden="true"><span /><span /><span /></span>
          <span>UTP <strong>WORKSPACE</strong><small>PROJECT MEMORY</small></span>
        </a>
        <nav className="workspace-nav" aria-label="Navigasi utama">
          {navigation.map(({ view, title, icon: Icon }) => (
            <button key={view} aria-label={title} onClick={() => onSelectView(view)} className={currentView === view ? 'is-current' : ''} aria-current={currentView === view ? 'page' : undefined}>
              <Icon size={15} strokeWidth={1.6} /><span>{title}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="handover-button" title="Serahan Codex" aria-label="Buka serahan Codex" onClick={() => onSelectView('CODEX')}><FileText size={16} /></button>
          <button className="command-button command-button-gold header-upload" onClick={onOpenUpload}>Unggah berkas <ArrowUpRight size={15} /></button>
          <span className="workspace-avatar" title="Ruang kerja lokal">UTP</span>
        </div>
      </div>
      <div className="header-context">
        <div className="workspace-width context-inner">
          <div className="project-picker">
            <Building2 size={14} strokeWidth={1.5} /><span className="project-picker-label">Ruang proyek</span>
            <div className="project-select-wrap">
              <select aria-label="Pilih Proyek Aktif" value={selectedProjectId} onChange={e => onSelectProject(e.target.value as ProjectId)}>
                <option value="ALL">Semua proyek</option>
                {projects.filter(p => p.id !== 'ALL').map(p => <option key={p.id} value={p.id}>{p.name} [{p.code}]</option>)}
              </select>
              <ChevronDown size={12} aria-hidden="true" />
            </div>
          </div>
          <div className="memory-shortcuts"><span>AKSES CEPAT</span>{shortcuts.map(([type, title]) => <button key={type} onClick={() => onTriggerQuickQuestion(type)}>{title}</button>)}</div>
          <span className="context-edition">UTP / PROJECT OPERATIONS</span>
        </div>
      </div>
    </header>
  );
}

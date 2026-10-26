import React, { useState, useEffect } from 'react';
import { DocumentRecord, KanbanStatus, ProjectId, ProjectInfo, StructuredFact, DocumentFileAttachment } from './types';
import { storageService } from './services/storageService';
import { Header } from './components/Header';
import { KanbanBoard } from './components/KanbanBoard';
import { DocumentDetail } from './components/DocumentDetail';
import { UploadModal } from './components/UploadModal';
import { MemoryExplorer } from './components/MemoryExplorer';
import { SearchPanel } from './components/SearchPanel';
import { TelegramSimulator } from './components/TelegramSimulator';
import { CodexHandoverModal } from './components/CodexHandoverModal';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'KANBAN' | 'MEMORY' | 'SEARCH' | 'TELEGRAM' | 'CODEX'>('KANBAN');
  const [selectedProjectId, setSelectedProjectId] = useState<ProjectId>('ALL');
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);
  const [allDocsWithArchived, setAllDocsWithArchived] = useState<DocumentRecord[]>([]);
  const [selectedDocument, setSelectedDocument] = useState<DocumentRecord | null>(null);
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [searchInitialQuery, setSearchInitialQuery] = useState('');

  // Reload data from storage
  const reloadData = () => {
    const prjs = storageService.getProjects();
    const docs = storageService.getDocuments(selectedProjectId, false);
    const withArchived = storageService.getDocuments(selectedProjectId, true).concat(docs);

    setProjects(prjs);
    setDocuments(docs);
    setAllDocsWithArchived(withArchived);

    // Keep active selected doc updated if open
    if (selectedDocument) {
      const refreshed = storageService.getDocumentById(selectedDocument.id);
      setSelectedDocument(refreshed || null);
    }
  };

  useEffect(() => {
    reloadData();
  }, [selectedProjectId]);

  const handleStatusChange = (docId: string, status: KanbanStatus, reason?: string) => {
    storageService.updateKanbanStatus(docId, status, reason);
    reloadData();
  };

  const handleToggleArchive = (docId: string) => {
    storageService.toggleArchive(docId);
    reloadData();
  };

  const handleSaveFacts = (docId: string, facts: StructuredFact[], notes?: string) => {
    storageService.updateDocumentFacts(docId, facts, notes);
    reloadData();
  };

  const handleAttachFile = (docId: string, file: DocumentFileAttachment) => {
    storageService.attachFileToDocument(docId, file);
    reloadData();
  };

  const handleDocumentCreated = (newDoc: DocumentRecord) => {
    const saved = storageService.createDocument(newDoc);
    reloadData();
    setSelectedDocument(saved);
  };

  const handleTriggerQuickQuestion = (queryType: string) => {
    setCurrentView('SEARCH');
    switch (queryType) {
      case 'MANPOWER_MENUNGGU':
        setSearchInitialQuery('manpower menunggu');
        break;
      case 'DI_MEJA_PM':
        setSearchInitialQuery('PM Bambang');
        break;
      case 'DEADLINE_MINGGU_INI':
        setSearchInitialQuery('2026');
        break;
      case 'BELUM_ADA_BALASAN':
        setSearchInitialQuery('surat belum balasan');
        break;
      case 'SCAN_BASAH':
        setSearchInitialQuery('scan basah signed');
        break;
      default:
        setSearchInitialQuery('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-amber-500/20 selection:text-amber-300">
      {/* Top Header & Workspace Context Toolbar */}
      <Header
        currentView={currentView}
        onSelectView={setCurrentView}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onOpenUpload={() => setIsUploadOpen(true)}
        onTriggerQuickQuestion={handleTriggerQuickQuestion}
      />

      {/* Main Viewport Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <p className="mb-3 text-xs text-amber-300" role="note">Prototipe lokal dengan data contoh. Metadata tersimpan di browser ini; penyimpanan berkas asli dan koneksi backend belum tersedia.</p>
        {currentView === 'KANBAN' && (
          <KanbanBoard
            documents={documents}
            selectedProjectId={selectedProjectId}
            onOpenDocument={setSelectedDocument}
            onStatusChange={handleStatusChange}
          />
        )}

        {currentView === 'MEMORY' && (
          <MemoryExplorer
            documents={documents}
            allDocumentsIncludingArchived={allDocsWithArchived}
            selectedProjectId={selectedProjectId}
            onOpenDocument={setSelectedDocument}
            onToggleArchive={handleToggleArchive}
          />
        )}

        {currentView === 'SEARCH' && (
          <SearchPanel
            documents={documents}
            initialQuery={searchInitialQuery}
            onOpenDocument={setSelectedDocument}
          />
        )}

        {currentView === 'TELEGRAM' && (
          <TelegramSimulator
            projects={projects}
            documents={documents}
            onOpenDocument={setSelectedDocument}
          />
        )}

        {currentView === 'CODEX' && (
          <CodexHandoverModal />
        )}
      </main>

      {/* Slide-over Document Memory Detail Drawer */}
      <DocumentDetail
        document={selectedDocument}
        onClose={() => setSelectedDocument(null)}
        onStatusChange={handleStatusChange}
        onToggleArchive={handleToggleArchive}
        onSaveFacts={handleSaveFacts}
        onAttachFile={handleAttachFile}
      />

      {/* Upload & Smart Ingestion Modal */}
      {isUploadOpen && <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        projects={projects}
        selectedProjectId={selectedProjectId}
        existingDocs={documents}
        onDocumentCreated={handleDocumentCreated}
      />}

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 bg-slate-950/90 py-3 text-center text-[11px] text-slate-400">
        <span>PT Utama Tunggal Perkasa (PT UTP) · Sistem Pengendalian & Memori Dokumen Proyek</span>
        <span aria-hidden="true" className="mx-2">·</span>
        <span>Target Deploy: Cloudflare Pages & Workers</span>
      </footer>
    </div>
  );
};
export default App;

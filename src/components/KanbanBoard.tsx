import React, { useState } from 'react';
import { DocumentRecord, KanbanStatus, ProjectId } from '../types';
import { 
  Clock, 
  UserCheck, 
  Paperclip, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle, 
  FileCheck,
  Building,
  MoreVertical,
  ExternalLink
} from 'lucide-react';

interface KanbanBoardProps {
  documents: DocumentRecord[];
  selectedProjectId: ProjectId;
  onOpenDocument: (doc: DocumentRecord) => void;
  onStatusChange: (docId: string, newStatus: KanbanStatus, reason?: string) => void;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  documents,
  selectedProjectId,
  onOpenDocument,
  onStatusChange,
}) => {
  const [draggedDocId, setDraggedDocId] = useState<string | null>(null);

  // Filter only actionable documents that belong on the work board
  const actionableDocs = documents.filter(doc => doc.isActionable);

  const columns: { status: KanbanStatus; title: string; subtitle: string; color: string }[] = [
    {
      status: 'AKTIF',
      title: 'Aktif',
      subtitle: 'Pekerjaan & berkas yang sedang diproses di lapangan / admin',
      color: 'border-blue-500/30 text-blue-400 bg-blue-500/5',
    },
    {
      status: 'MENUNGGU',
      title: 'Menunggu',
      subtitle: 'Menunggu tindakan, paraf, persetujuan PM, MK, HO, atau Owner',
      color: 'border-amber-500/30 text-amber-400 bg-amber-500/5',
    },
    {
      status: 'SELESAI',
      title: 'Selesai',
      subtitle: 'Tindak lanjut administratif tuntas (arsip bukti lengkap)',
      color: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/5',
    },
  ];

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    setDraggedDocId(id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, status: KanbanStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('text/plain') || draggedDocId;
    if (id) {
      onStatusChange(id, status);
    }
    setDraggedDocId(null);
  };

  return (
    <div className="space-y-4">
      {/* Board Summary Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-lg border border-slate-800 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-200">Meja Pengendalian Proyek</span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            {actionableDocs.length} berkas aktif membutuhkan perhatian
          </span>
          <span aria-hidden="true" className="text-slate-600">·</span>
          <span className="text-slate-400">
            {documents.filter(d => !d.isActionable).length} dokumen referensi/pedoman tersimpan di Memori
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span className="w-2 h-2 rounded-full bg-amber-400 inline-block"></span>
          <span>Perpindahan kartu ke Selesai tidak menciptakan approval bisnis palsu</span>
        </div>
      </div>

      {/* 3-Column Kanban Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[580px]">
        {columns.map(col => {
          const colDocs = actionableDocs.filter(d => d.kanbanStatus === col.status);

          return (
            <div
              key={col.status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, col.status)}
              className="flex flex-col bg-slate-900/40 rounded-lg border border-slate-800/80 p-3 transition-colors"
            >
              {/* Column Header */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-sm text-slate-100">{col.title}</h3>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold tabular-nums">
                      {colDocs.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{col.subtitle}</p>
                </div>
              </div>

              {/* Cards Container */}
              <div className="flex-1 space-y-2.5 overflow-y-auto pr-1">
                {colDocs.length === 0 ? (
                  <div className="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
                    <p>Tidak ada berkas di kolom {col.title}</p>
                    <p className="text-[10px] text-slate-600 mt-1">Tarik kartu ke sini atau gunakan tombol pindah</p>
                  </div>
                ) : (
                  colDocs.map(doc => {
                    const hasSignedScan = doc.files.some(f => f.fileRole === 'SCAN_BASAH');
                    const hasReply = doc.files.some(f => f.fileRole === 'SURAT_BALASAN');

                    return (
                      <div
                        key={doc.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, doc.id)}
                        onClick={() => onOpenDocument(doc)}
                        className="group bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-slate-700/80 rounded-md p-3 shadow-xs cursor-pointer transition-all duration-150 relative"
                      >
                        {/* Top Line: Project Tag (if viewing ALL) & Category */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5 gap-2">
                          <div className="flex items-center gap-1.5 truncate">
                            {selectedProjectId === 'ALL' && (
                              <span className="font-mono font-semibold text-amber-400 shrink-0">
                                {doc.projectId.replace('PRJ-', '')}
                              </span>
                            )}
                            <span className="text-slate-400 truncate font-mono">
                              {doc.documentNumber}
                            </span>
                          </div>

                          {doc.deadline && (
                            <div className="flex items-center gap-1 font-mono text-[11px] text-amber-300/90 shrink-0">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span className="tabular-nums">{doc.deadline}</span>
                            </div>
                          )}
                        </div>

                        {/* Card Title - Clean 14px text */}
                        <h4 className="text-sm font-semibold text-slate-100 group-hover:text-amber-200 transition-colors line-clamp-2 leading-snug">
                          {doc.title}
                        </h4>

                        {/* Waiting & Approval Metadata (Unboxed text with separators) */}
                        <div className="mt-2 text-xs text-slate-400 space-y-1">
                          {doc.waitingParty !== 'NONE' && (
                            <div className="flex items-center gap-1.5 text-slate-300">
                              <span className="text-slate-400">Menunggu:</span>
                              <span className="font-medium text-slate-200 truncate">
                                {doc.waitingPersonName || doc.waitingParty}
                              </span>
                            </div>
                          )}

                          {doc.requiredApproval && (
                            <div className="flex items-center gap-1.5 text-slate-400 text-[11px] truncate">
                              <span className="text-slate-400">Persetujuan:</span>
                              <span className="text-slate-300 truncate">{doc.requiredApproval}</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Row: File Attachment Count & Physical Proof Badges */}
                        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
                          <div className="flex items-center gap-2">
                            <span className="flex items-center gap-1">
                              <Paperclip className="w-3 h-3 text-slate-400" />
                              <span className="tabular-nums">{doc.files.length} berkas</span>
                            </span>

                            {hasSignedScan && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">·</span>
                                <span className="text-emerald-400 font-medium flex items-center gap-1">
                                  <FileCheck className="w-3 h-3" />
                                  <span>Scan Basah</span>
                                </span>
                              </>
                            )}

                            {hasReply && (
                              <>
                                <span aria-hidden="true" className="text-slate-600">·</span>
                                <span className="text-blue-400 font-medium">Ada Balasan</span>
                              </>
                            )}
                          </div>

                          {/* Quick move buttons */}
                          <div 
                            className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {col.status !== 'AKTIF' && (
                              <button
                                onClick={() => onStatusChange(doc.id, 'AKTIF')}
                                title="Kembalikan ke Aktif"
                                className="px-1.5 py-0.5 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                              >
                                Aktif
                              </button>
                            )}
                            {col.status !== 'MENUNGGU' && (
                              <button
                                onClick={() => onStatusChange(doc.id, 'MENUNGGU')}
                                title="Tandai Menunggu Pihak Lain"
                                className="px-1.5 py-0.5 text-[10px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 rounded border border-amber-500/40"
                              >
                                Tunggu
                              </button>
                            )}
                            {col.status !== 'SELESAI' && (
                              <button
                                onClick={() => onStatusChange(doc.id, 'SELESAI')}
                                title="Tandai Selesai Administratif"
                                className="px-1.5 py-0.5 text-[10px] bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 rounded border border-emerald-500/40"
                              >
                                Selesai
                              </button>
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
        })}
      </div>
    </div>
  );
};

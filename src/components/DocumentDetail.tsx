import React, { useState } from 'react';
import { DocumentRecord, KanbanStatus, StructuredFact, DocumentFileAttachment } from '../types';
import { 
  X, 
  FileText, 
  Paperclip, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Copy, 
  Check, 
  Archive, 
  Share2, 
  History, 
  UserCheck, 
  Tag, 
  Plus, 
  ExternalLink,
  Edit2,
  Save,
  FileCheck
} from 'lucide-react';

interface DocumentDetailProps {
  document: DocumentRecord | null;
  onClose: () => void;
  onStatusChange: (docId: string, status: KanbanStatus, reason?: string) => void;
  onToggleArchive: (docId: string) => void;
  onSaveFacts: (docId: string, facts: StructuredFact[], notes?: string) => void;
  onAttachFile: (docId: string, file: DocumentFileAttachment) => void;
}

export const DocumentDetail: React.FC<DocumentDetailProps> = ({
  document,
  onClose,
  onStatusChange,
  onToggleArchive,
  onSaveFacts,
  onAttachFile,
}) => {
  const [activeTab, setActiveTab] = useState<'MEMORI' | 'BERKAS' | 'RIWAYAT' | 'WA_DRAFT'>('MEMORI');
  const [copiedWA, setCopiedWA] = useState(false);
  const [isEditingFacts, setIsEditingFacts] = useState(false);
  const [editedFacts, setEditedFacts] = useState<StructuredFact[]>([]);
  const [correctionNote, setCorrectionNote] = useState('');
  const [previewFile, setPreviewFile] = useState<DocumentFileAttachment | null>(null);

  if (!document) return null;

  // Generate WhatsApp reminder message
  const waRecipient = document.waitingPersonName || 'Bapak/Ibu Tim Proyek';
  const waDraftMessage = `*PENGINGAT DOKUMEN PROYEK PT UTP*\n` +
    `Kepada Yth. ${waRecipient}\n\n` +
    `Mohon izin konfirmasi tindak lanjut dokumen berikut:\n` +
    `📄 *Perihal:* ${document.title}\n` +
    `📌 *No. Dokumen:* ${document.documentNumber}\n` +
    `🏢 *Proyek:* ${document.projectId}\n` +
    `⏳ *Tenggat / Target:* ${document.deadline || 'Belum ditentukan'}\n` +
    `📝 *Tindakan Diperlukan:* ${document.nextAction}\n\n` +
    `Mohon periksa berkas asli sebelum mengirim pengingat ini. Terima kasih.\n` +
    `_Admin Proyek PT UTP_`;

  const handleCopyWA = () => {
    navigator.clipboard.writeText(waDraftMessage);
    setCopiedWA(true);
    setTimeout(() => setCopiedWA(false), 2000);
  };

  const handleStartEdit = () => {
    setEditedFacts([...document.facts]);
    setCorrectionNote('');
    setIsEditingFacts(true);
  };

  const handleSaveEdit = () => {
    onSaveFacts(document.id, editedFacts, correctionNote || 'Koreksi manual metadata oleh Admin Proyek');
    setIsEditingFacts(false);
  };


  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-xs flex justify-end">
      <div 
        className="w-full max-w-2xl bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-modal="true"
      >
        {/* Top Header */}
        <div className="p-4 border-b border-slate-800 flex items-start justify-between gap-4 bg-slate-950/50">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="font-mono text-amber-400 font-semibold">{document.projectId}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono">{document.documentNumber}</span>
              <span aria-hidden="true">·</span>
              <span>{document.documentDate}</span>
            </div>
            <h2 className="text-base font-bold text-slate-100 leading-snug">
              {document.title}
            </h2>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleArchive(document.id)}
              title={document.isArchived ? "Pulihkan dari Arsip" : "Arsipkan Dokumen"}
              className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
            >
              <Archive className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Workflow Status Bar & Quick Actions */}
        <div className="px-4 py-2.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Status Meja:</span>
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded border border-slate-800">
              {(['AKTIF', 'MENUNGGU', 'SELESAI'] as KanbanStatus[]).map((st) => (
                <button
                  key={st}
                  onClick={() => onStatusChange(document.id, st)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded transition-colors ${
                    document.kanbanStatus === st
                      ? st === 'AKTIF' 
                        ? 'bg-blue-600 text-white' 
                        : st === 'MENUNGGU' 
                        ? 'bg-amber-600 text-white' 
                        : 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {document.deadline && (
              <div className="flex items-center gap-1 text-amber-300 font-mono text-[11px]">
                <Clock className="w-3.5 h-3.5" />
                <span>Tenggat: {document.deadline}</span>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-4 pt-2 border-b border-slate-800 text-xs font-medium">
          <button
            onClick={() => setActiveTab('MEMORI')}
            className={`pb-2 px-3 border-b-2 transition-colors ${
              activeTab === 'MEMORI'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Fakta & Memori
          </button>
          <button
            onClick={() => setActiveTab('BERKAS')}
            className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'BERKAS'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Berkas & Versi</span>
            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.2 rounded text-slate-300">
              {document.files.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('WA_DRAFT')}
            className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'WA_DRAFT'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Share2 className="w-3 h-3 text-emerald-400" />
            <span>Draf WhatsApp</span>
          </button>
          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`pb-2 px-3 border-b-2 transition-colors ${
              activeTab === 'RIWAYAT'
                ? 'border-amber-400 text-amber-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Riwayat Aktivitas
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {activeTab === 'MEMORI' && (
            <div className="space-y-4">
              {/* Executive Summary & Next Action */}
              <div className="bg-slate-950/60 p-3.5 rounded-lg border border-slate-800 space-y-2.5">
                <div>
                  <h3 className="text-xs font-semibold text-slate-300 mb-1">Ringkasan Dokumen</h3>
                  <p className="text-slate-200 leading-relaxed text-xs">{document.summary}</p>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <h3 className="text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1">
                    <span>Tindakan Berikutnya / Follow-up</span>
                  </h3>
                  <p className="text-slate-300 leading-relaxed text-xs">{document.nextAction}</p>
                </div>
              </div>

              {/* Manpower Specific Facts Card if Category is MEMO_MANPOWER */}
              {document.manpowerDetails && (
                <div className="bg-amber-950/20 p-3.5 rounded-lg border border-amber-500/30 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-amber-400" />
                      <span>Rincian Memori Manpower</span>
                    </h3>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      USULAN: {document.manpowerDetails.changeType}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[11px]">Jumlah Personel:</span>
                      <strong className="text-slate-100 font-semibold">{document.manpowerDetails.headcount} Orang</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Posisi / Jabatan:</span>
                      <span className="text-slate-100">{document.manpowerDetails.position}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Lokasi Penempatan:</span>
                      <span className="text-slate-200">{document.manpowerDetails.placementLocation}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Tanggal Efektif:</span>
                      <span className="text-slate-200 font-mono">{document.manpowerDetails.effectiveDate}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Pengaju Dokumen:</span>
                      <span className="text-slate-200">{document.manpowerDetails.applicant}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[11px]">Pihak Persetujuan:</span>
                      <span className="text-amber-200 font-medium">{document.manpowerDetails.approver}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-amber-500/20 text-[11px]">
                    <span className="text-slate-400">Status Keputusan Dokumen: </span>
                    <span className="text-slate-200">{document.manpowerDetails.decisionMentioned}</span>
                  </div>
                </div>
              )}

              {/* Structured Facts Table with Source Distinction */}
              <div className="bg-slate-950/40 rounded-lg border border-slate-800 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-slate-200">Fakta Terstruktur</h3>
                    <p className="text-[11px] text-slate-400">
                      Membedakan fakta dari dokumen, dugaan sistem, dan koreksi pengguna
                    </p>
                  </div>
                  {!isEditingFacts ? (
                    <button
                      onClick={handleStartEdit}
                      className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700 flex items-center gap-1 transition-colors"
                    >
                      <Edit2 className="w-3 h-3" />
                      <span>Koreksi Memori</span>
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={handleSaveEdit}
                        className="px-2 py-1 text-[11px] bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded flex items-center gap-1 transition-colors"
                      >
                        <Save className="w-3 h-3" />
                        <span>Simpan</span>
                      </button>
                      <button
                        onClick={() => setIsEditingFacts(false)}
                        className="px-2 py-1 text-[11px] bg-slate-800 text-slate-400 hover:text-slate-200 rounded"
                      >
                        Batal
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {(isEditingFacts ? editedFacts : document.facts).map((fact, idx) => (
                    <div 
                      key={fact.key || idx} 
                      className="flex items-start justify-between p-2 rounded bg-slate-900/80 border border-slate-800/80 gap-3 text-xs"
                    >
                      <div className="w-1/3">
                        <span className="text-slate-400 font-medium">{fact.label}</span>
                      </div>
                      <div className="w-1/2">
                        {isEditingFacts ? (
                          <input
                            type="text"
                            value={fact.value}
                            onChange={(e) => {
                              const updated = [...editedFacts];
                              updated[idx] = { ...updated[idx], value: e.target.value, sourceType: 'KOREKSI_USER' };
                              setEditedFacts(updated);
                            }}
                            className="w-full bg-slate-950 text-slate-100 border border-slate-700 rounded px-2 py-1 text-xs"
                          />
                        ) : (
                          <span className="text-slate-200">{fact.value}</span>
                        )}
                        {fact.pageOrLocation && <p className="mt-1 text-[10px] text-slate-400">Sumber: {fact.pageOrLocation}</p>}
                      </div>
                      <div className="w-1/6 text-right shrink-0">
                        <span className={`text-[10px] font-mono ${
                          fact.sourceType === 'DOKUMEN_FAKTA'
                            ? 'text-emerald-400'
                            : fact.sourceType === 'KOREKSI_USER'
                            ? 'text-blue-400'
                            : 'text-amber-400'
                        }`}>
                          {fact.sourceType === 'DOKUMEN_FAKTA' ? 'FAKTA DOK' : fact.sourceType === 'KOREKSI_USER' ? 'KOREKSI' : 'DUGAAN'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {isEditingFacts && (
                  <div className="pt-2 border-t border-slate-800">
                    <label className="text-[11px] text-slate-400 block mb-1">Catatan koreksi (opsional):</label>
                    <input
                      type="text"
                      placeholder="Contoh: Nama mandor disesuaikan dari catatan meeting site"
                      value={correctionNote}
                      onChange={(e) => setCorrectionNote(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 border border-slate-700 rounded px-2 py-1 text-xs"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'BERKAS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Berkas Terhubung ke Dokumen Ini</h3>
                  <p className="text-[11px] text-slate-400">
                    Satu rekam dokumen dapat memuat berkas asli, revisi, scan basah, dan surat balasan.
                  </p>
                </div>
                
                {/* Upload attachment shortcuts */}
                <div className="flex items-center gap-1.5">
                  <button
                    disabled title="Penyimpanan berkas belum terhubung"
                    className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded border border-emerald-500/30 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Scan Basah</span>
                  </button>
                  <button
                    disabled title="Penyimpanan berkas belum terhubung"
                    className="px-2 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-blue-300 rounded border border-blue-500/30 flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    <span>+ Balasan</span>
                  </button>
                </div>
              </div>

              {/* Files List */}
              <p className="text-xs text-amber-300">Penyimpanan berkas belum terhubung. Penambahan scan/balasan belum tersedia; daftar ini berisi metadata dan dapat memuat data contoh.</p>
              <div className="space-y-2.5">
                {document.files.map((file) => (
                  <div 
                    key={file.id}
                    className="p-3 bg-slate-950/70 border border-slate-800 rounded-lg flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="p-2 rounded bg-slate-800 text-slate-300 shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="text-slate-100 font-medium truncate block">
                            {file.fileName}
                          </strong>
                          <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded ${
                            file.fileRole === 'SCAN_BASAH'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : file.fileRole === 'SURAT_BALASAN'
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              : file.fileRole === 'ASLI'
                              ? 'bg-slate-800 text-slate-300'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}>
                            {file.fileRole}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                          <span>{(file.fileSize / 1024).toFixed(1)} KB</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono">{file.storageLocation}</span>
                        </div>
                        {file.textSnippet && (
                          <p className="text-[11px] text-slate-400 italic mt-1.5 line-clamp-2 bg-slate-900/60 p-1.5 rounded">
                            "{file.textSnippet}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">
                      <button
                        onClick={() => setPreviewFile(file)}
                        className="px-2.5 py-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 transition-colors flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Pratinjau</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Preview Modal Simulation if opened */}
              {previewFile && (
                <div className="p-4 bg-slate-950 border border-amber-500/40 rounded-lg space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-amber-400" />
                      <span className="font-semibold text-slate-200">{previewFile.fileName}</span>
                    </div>
                    <button
                      onClick={() => setPreviewFile(null)}
                      className="text-xs text-slate-400 hover:text-white"
                    >
                      Tutup
                    </button>
                  </div>
                  <div className="p-3 bg-slate-900 rounded font-mono text-[11px] text-slate-300 whitespace-pre-wrap">
                    {previewFile.textSnippet || 'Belum tersedia isi berkas untuk ditampilkan. Metadata ini bukan bukti penyimpanan atau verifikasi berkas asli.'}
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Lokasi: {previewFile.storageLocation} (ID Drive: {previewFile.driveFileId})
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'WA_DRAFT' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-semibold text-slate-200">Draf Pengingat WhatsApp Siap Salin</h3>
                  <p className="text-[11px] text-slate-400">
                    Salin pesan format ini dan kirimkan langsung via WhatsApp ke PM, MK, HO, atau Owner.
                  </p>
                </div>
                <button
                  onClick={handleCopyWA}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white rounded flex items-center gap-1.5 transition-colors"
                >
                  {copiedWA ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersalin ke Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Salin Pesan WA</span>
                    </>
                  )}
                </button>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs font-mono text-emerald-300/90 whitespace-pre-wrap leading-relaxed shadow-inner">
                {waDraftMessage}
              </div>

              <div className="p-3 bg-slate-950/60 border border-slate-800 rounded text-[11px] text-slate-400">
                <strong className="text-slate-300 font-medium">Anti-Pesan Liar:</strong> Sistem tidak mengirim pesan ke pihak eksternal secara otomatis. Admin memegang kendali penuh untuk meninjau dan mengirimkan sendiri.
              </div>
            </div>
          )}

          {activeTab === 'RIWAYAT' && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-200">Audit Trail & Riwayat Aktivitas</h3>
              <div className="space-y-2 border-l-2 border-slate-800 pl-3 ml-2">
                {document.activityLog.map((log) => (
                  <div key={log.id} className="relative pb-2">
                    <div className="absolute -left-[19px] top-1 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-slate-900"></div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono text-slate-400">{log.timestamp}</span>
                      <span aria-hidden="true">·</span>
                      <strong className="text-slate-300">{log.actor}</strong>
                    </div>
                    <div className="text-xs font-semibold text-slate-200 mt-0.5">{log.action}</div>
                    {log.details && (
                      <p className="text-[11px] text-slate-400 mt-0.5">{log.details}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

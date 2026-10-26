import React, { useState, useRef } from 'react';
import { ProjectId, ProjectInfo, DocumentRecord, ParseResult, DocumentFileAttachment } from '../types';
import { parseDocumentFile } from '../services/parserService';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Layers,
  Sparkles,
  Link2
} from 'lucide-react';

interface UploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  projects: ProjectInfo[];
  selectedProjectId: ProjectId;
  existingDocs: DocumentRecord[];
  onDocumentCreated: (doc: DocumentRecord) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  isOpen,
  onClose,
  projects,
  selectedProjectId,
  existingDocs,
  onDocumentCreated,
}) => {
  const [targetProject, setTargetProject] = useState<ProjectId>(
    selectedProjectId === 'ALL' ? 'PRJ-BDG' : selectedProjectId
  );
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('');
  const [parsedResults, setParsedResults] = useState<ParseResult[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const newFiles = Array.from(files);
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setErrorMsg(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleProcessFiles = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setErrorMsg(null);
    setParsedResults([]);

    try {
      // Step 1: Ingesting & Saving original file
      setProgressStep('1/3 Menyimpan berkas asli ke repositori Google Drive...');
      await new Promise(r => setTimeout(r, 400));

      // Step 2: Content Parsing & Structured Extraction
      setProgressStep('2/3 Membaca isi berkas & mengekstrak fakta terstruktur...');
      await new Promise(r => setTimeout(r, 600));

      const results: ParseResult[] = [];
      for (const file of selectedFiles) {
        const parsed = parseDocumentFile(
          {
            file,
            overrideProjectId: targetProject,
          },
          existingDocs
        );
        results.push(parsed);
      }

      // Step 3: Mapping to Memory
      setProgressStep('3/3 Menentukan kebutuhan kartu Kanban & tindak lanjut...');
      await new Promise(r => setTimeout(r, 300));

      setParsedResults(results);
    } catch (err: any) {
      setErrorMsg('Gagal memproses dokumen. Berkas asli tetap aman dan dapat dicoba kembali.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCommitToMemory = () => {
    parsedResults.forEach((parsed, index) => {
      const file = selectedFiles[index];
      const docId = `DOC-${parsed.projectId.replace('PRJ-', '')}-${Date.now()}-${index}`;

      const initialFile: DocumentFileAttachment = {
        id: `FILE-${Date.now()}-${index}`,
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream',
        uploadedAt: new Date().toISOString(),
        fileRole: parsed.suggestedRelation?.relationType === 'REVISI_DARI' 
          ? 'REVISI' 
          : parsed.suggestedRelation?.relationType === 'BALASAN_DARI'
          ? 'SURAT_BALASAN'
          : 'ASLI',
        storageLocation: `Google Drive: /PT UTP/${parsed.projectId}/${parsed.category}/`,
        driveFileId: `drv_${Date.now()}_${index}`,
        textSnippet: `Teks dokumen ${file.name} terbaca dan dipetakan ke memori proyek.`
      };

      const newDoc: DocumentRecord = {
        id: docId,
        projectId: parsed.projectId,
        title: parsed.title,
        documentNumber: parsed.documentNumber,
        documentDate: parsed.documentDate,
        category: parsed.category,
        isActionable: parsed.isActionable,
        kanbanStatus: 'AKTIF',
        waitingParty: parsed.waitingParty,
        waitingPersonName: parsed.waitingPersonName,
        requiredApproval: parsed.requiredApproval,
        deadline: parsed.deadline,
        followUpDate: parsed.followUpDate,
        summary: parsed.summary,
        nextAction: parsed.nextAction,
        facts: parsed.facts,
        manpowerDetails: parsed.manpowerDetails,
        files: [initialFile],
        relations: parsed.suggestedRelation ? [{
          targetDocId: parsed.suggestedRelation.targetDocId,
          targetDocTitle: parsed.suggestedRelation.targetDocTitle,
          relationType: parsed.suggestedRelation.relationType,
          isConfirmed: true
        }] : [],
        activityLog: [
          {
            id: `ACT-${Date.now()}`,
            timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
            actor: 'Admin Proyek',
            action: 'Unggah & Ekstraksi Berkas Asli',
            details: `Berkas ${file.name} diproses ke memori proyek.`
          }
        ],
        isArchived: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      onDocumentCreated(newDoc);
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div 
        className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-lg shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
              <Upload className="w-4 h-4 text-amber-400" />
              <span>Unggah Berkas ke Memori Proyek</span>
            </h2>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Kirim berkas tanpa perlu isi formulir manual. Sistem membaca dan memetakan fakta secara otomatis.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 space-y-4 text-xs">
          {/* Target Project Selection */}
          <div className="space-y-1">
            <label className="text-slate-300 font-medium block">Konteks Proyek:</label>
            <select
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value as ProjectId)}
              className="w-full bg-slate-950 text-slate-100 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-medium"
            >
              {projects.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} [{p.code}] - PM: {p.pmName}
                </option>
              ))}
            </select>
          </div>

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-700 hover:border-amber-400/60 bg-slate-950/40 rounded-lg p-6 text-center cursor-pointer transition-colors"
          >
            <input
              type="file"
              ref={fileInputRef}
              multiple
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
            <Upload className="w-8 h-8 text-amber-400/80 mx-auto mb-2" />
            <p className="text-slate-200 font-medium">
              Tarik berkas ke sini atau <span className="text-amber-400 underline">pilih dari komputer</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-1">
              Mendukung PDF, Word (.docx), Excel (.xlsx), Scan/Foto (.jpg/.png)
            </p>
          </div>

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>{selectedFiles.length} berkas dipilih:</span>
                <button
                  onClick={() => { setSelectedFiles([]); setParsedResults([]); }}
                  className="text-rose-400 hover:underline"
                >
                  Bersihkan
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((f, i) => (
                  <div 
                    key={i} 
                    className="flex items-center justify-between p-2 rounded bg-slate-950/70 border border-slate-800 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span className="text-slate-200 truncate">{f.name}</span>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0">
                      {(f.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Processing State */}
          {isProcessing && (
            <div className="p-3 bg-amber-950/20 border border-amber-500/30 rounded-lg text-amber-300 text-xs flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-amber-400 shrink-0" />
              <span>{progressStep}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-rose-950/30 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Parsed Results Preview */}
          {parsedResults.length > 0 && !isProcessing && (
            <div className="p-3 bg-slate-950 border border-emerald-500/40 rounded-lg space-y-2.5">
              <div className="flex items-center justify-between text-emerald-400 font-semibold text-xs">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{parsedResults.length} Dokumen Berhasil Dipetakan</span>
                </span>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {parsedResults.map((p, idx) => (
                  <div key={idx} className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1 text-xs">
                    <div className="flex items-center justify-between">
                      <strong className="text-slate-100 font-medium">{p.title}</strong>
                      <span className="text-[10px] font-mono text-amber-400">{p.documentNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-300">{p.summary}</p>
                    <div className="text-[10px] text-slate-400 flex items-center gap-2 pt-1 border-t border-slate-800">
                      <span>Kategori: {p.category}</span>
                      <span aria-hidden="true">·</span>
                      <span>Menunggu: {p.waitingParty} ({p.waitingPersonName})</span>
                    </div>
                    {p.suggestedRelation && (
                      <div className="text-[10px] text-blue-300 flex items-center gap-1 pt-1">
                        <Link2 className="w-3 h-3 text-blue-400" />
                        <span>Terdeteksi terkait: "{p.suggestedRelation.targetDocTitle}"</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3 text-xs">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-slate-400 hover:text-slate-200"
          >
            Tutup
          </button>

          <div className="flex items-center gap-2">
            {parsedResults.length === 0 ? (
              <button
                disabled={selectedFiles.length === 0 || isProcessing}
                onClick={handleProcessFiles}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 disabled:pointer-events-none rounded transition-colors flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Baca & Petakan Isi Berkas</span>
              </button>
            ) : (
              <button
                onClick={handleCommitToMemory}
                className="px-4 py-1.5 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded transition-colors flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan ke Memori Proyek</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

import { DocumentRecord, KanbanStatus, ProjectId, ProjectInfo, StructuredFact, DocumentFileAttachment } from '../types';
import { INITIAL_DOCUMENTS, INITIAL_PROJECTS } from './mockFiles';

const STORAGE_KEY_DOCS = 'utp_project_memory_docs_v1';
const STORAGE_KEY_PROJECTS = 'utp_project_memory_projects_v1';

class StorageService {
  private docs: DocumentRecord[] = [];
  private projects: ProjectInfo[] = [];

  constructor() {
    this.load();
  }

  private load(): void {
    try {
      const savedDocs = localStorage.getItem(STORAGE_KEY_DOCS);
      const savedProjects = localStorage.getItem(STORAGE_KEY_PROJECTS);

      if (savedDocs) {
        this.docs = JSON.parse(savedDocs);
      } else {
        this.docs = [...INITIAL_DOCUMENTS];
        this.saveDocs();
      }

      if (savedProjects) {
        this.projects = JSON.parse(savedProjects);
      } else {
        this.projects = [...INITIAL_PROJECTS];
        this.saveProjects();
      }
    } catch {
      // In case localStorage is disabled or corrupted
      this.docs = [...INITIAL_DOCUMENTS];
      this.projects = [...INITIAL_PROJECTS];
    }
  }

  private saveDocs(): void {
    try {
      localStorage.setItem(STORAGE_KEY_DOCS, JSON.stringify(this.docs));
    } catch (err) {
      console.warn('Failed to persist docs to localStorage:', err);
    }
  }

  private saveProjects(): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(this.projects));
    } catch (err) {
      console.warn('Failed to persist projects to localStorage:', err);
    }
  }

  public getProjects(): ProjectInfo[] {
    return this.projects;
  }

  public getProject(id: ProjectId): ProjectInfo | undefined {
    return this.projects.find(p => p.id === id);
  }

  public getDocuments(projectId?: ProjectId, includeArchived = false): DocumentRecord[] {
    return this.docs.filter(doc => {
      if (!includeArchived && doc.isArchived) return false;
      if (includeArchived && !doc.isArchived) return false;
      if (!projectId || projectId === 'ALL') return true;
      // Allow project-specific docs, plus general PT UTP references
      return doc.projectId === projectId || (doc.category === 'REFERENSI_STANDAR' && doc.projectId === 'PRJ-HO');
    });
  }

  public getDocumentById(id: string): DocumentRecord | undefined {
    return this.docs.find(d => d.id === id);
  }

  public createDocument(doc: DocumentRecord): DocumentRecord {
    // Only a shared memory identity allows linking; numbers and filenames are not unique.
    const existing = this.docs.find(d => 
      d.projectId === doc.projectId && 
      d.id === doc.id
    );

    if (existing) {
      // Append the new file to existing document instead of creating a clone
      const newFiles = doc.files.filter(f => !existing.files.some(ef => ef.id === f.id));
      existing.files.push(...newFiles);
      existing.activityLog.unshift({
        id: `ACT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        actor: 'Admin Proyek',
        action: 'Lampiran Baru Dihubungkan',
        details: `Menghubungkan berkas ${newFiles.map(f => f.fileName).join(', ')} ke kartu ini.`
      });
      existing.updatedAt = new Date().toISOString();
      this.saveDocs();
      return existing;
    }

    this.docs.unshift(doc);
    this.saveDocs();
    return doc;
  }

  public attachFileToDocument(docId: string, file: DocumentFileAttachment): DocumentRecord | null {
    const doc = this.getDocumentById(docId);
    if (!doc) return null;

    doc.files.push(file);
    doc.activityLog.unshift({
      id: `ACT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      actor: 'Admin Proyek',
      action: 'Unggah Berkas Baru',
      details: `Menambahkan berkas ${file.fileName} dengan peran ${file.fileRole}`
    });
    doc.updatedAt = new Date().toISOString();
    this.saveDocs();
    return doc;
  }

  public updateKanbanStatus(id: string, status: KanbanStatus, reason?: string): DocumentRecord | null {
    const doc = this.docs.find(d => d.id === id);
    if (!doc) return null;

    const oldStatus = doc.kanbanStatus;
    doc.kanbanStatus = status;
    doc.updatedAt = new Date().toISOString();

    doc.activityLog.unshift({
      id: `ACT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      actor: 'Admin Proyek',
      action: `Status Diubah: ${oldStatus} → ${status}`,
      details: reason || (status === 'SELESAI' 
        ? 'Pekerjaan ditandai selesai administratif. (Tidak otomatis menciptakan approval bisnis jika belum ditandatangani).' 
        : `Dipindahkan ke kolom ${status}`)
    });

    this.saveDocs();
    return doc;
  }

  public updateDocumentFacts(id: string, facts: StructuredFact[], notes?: string): DocumentRecord | null {
    const doc = this.docs.find(d => d.id === id);
    if (!doc) return null;

    doc.facts = facts;
    if (notes) {
      doc.activityLog.unshift({
        id: `ACT-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        actor: 'Admin Proyek',
        action: 'Koreksi Memori Pengguna',
        details: notes
      });
    }
    doc.updatedAt = new Date().toISOString();
    this.saveDocs();
    return doc;
  }

  public updateDocumentFields(id: string, updates: Partial<DocumentRecord>): DocumentRecord | null {
    const doc = this.docs.find(d => d.id === id);
    if (!doc) return null;

    Object.assign(doc, updates);
    doc.updatedAt = new Date().toISOString();
    this.saveDocs();
    return doc;
  }

  public toggleArchive(id: string): DocumentRecord | null {
    const doc = this.docs.find(d => d.id === id);
    if (!doc) return null;

    doc.isArchived = !doc.isArchived;
    doc.archivedAt = doc.isArchived ? new Date().toISOString() : undefined;
    doc.activityLog.unshift({
      id: `ACT-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      actor: 'Admin Proyek',
      action: doc.isArchived ? 'Dokumen Diarsipkan' : 'Dokumen Dipulihkan dari Arsip',
      details: doc.isArchived ? 'Disembunyikan dari meja kerja aktif' : 'Dikembalikan ke meja kerja aktif'
    });
    doc.updatedAt = new Date().toISOString();
    this.saveDocs();
    return doc;
  }

  public resetToDefaults(): void {
    this.docs = [...INITIAL_DOCUMENTS];
    this.projects = [...INITIAL_PROJECTS];
    this.saveDocs();
    this.saveProjects();
  }

  // --- Specialized Memory Query Helpers (Answering Prompt Questions) ---

  // 1. "Memo penambahan manpower mana yang masih menunggu?"
  public getPendingManpowerMemos(): DocumentRecord[] {
    return this.docs.filter(d => 
      !d.isArchived && 
      d.category === 'MEMO_MANPOWER' && 
      (d.kanbanStatus === 'MENUNGGU' || d.waitingParty === 'PM')
    );
  }

  // 2. "Dokumen apa yang sekarang berada di PM?"
  public getDocumentsAtPM(): DocumentRecord[] {
    return this.docs.filter(d => !d.isArchived && d.waitingParty === 'PM');
  }

  // 3. "Apa yang harus saya tindak lanjuti minggu ini?"
  public getFollowUpsThisWeek(): DocumentRecord[] {
    return this.docs.filter(d => !d.isArchived && d.kanbanStatus !== 'SELESAI' && d.deadline);
  }

  // 4. "Surat ini sudah ada balasannya atau belum?"
  public getUnansweredLetters(): DocumentRecord[] {
    return this.docs.filter(d => 
      !d.isArchived && 
      d.category === 'SURAT_KORESPONDENSI' && 
      !d.files.some(f => f.fileRole === 'SURAT_BALASAN')
    );
  }

  // 5. "Mana scan bertanda tangan dari dokumen tersebut?"
  public getDocumentsWithSignedScans(): DocumentRecord[] {
    return this.docs.filter(d => 
      d.files.some(f => f.fileRole === 'SCAN_BASAH')
    );
  }
}

export const storageService = new StorageService();

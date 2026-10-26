export type ProjectId = 'ALL' | 'PRJ-BDG' | 'PRJ-CKR' | 'PRJ-IKN' | 'PRJ-HO';

export interface ProjectInfo {
  id: ProjectId;
  code: string;
  name: string;
  location: string;
  pmName: string;
  mkName: string;
  ownerName: string;
  urgency: 'TINGGI' | 'SEDANG' | 'NORMAL';
  activeCardsCount: number;
}

export type DocumentCategory = 
  | 'MEMO_MANPOWER' 
  | 'SURAT_KORESPONDENSI' 
  | 'RPB_MATERIAL' 
  | 'APPROVAL_SPEK' 
  | 'RPD_KEUANGAN' 
  | 'KONTRAK_SEWA' 
  | 'SCAN_TANDATANGAN' 
  | 'REFERENSI_STANDAR';

export type KanbanStatus = 'AKTIF' | 'MENUNGGU' | 'SELESAI';

export type WaitingParty = 'PM' | 'MK' | 'HO_DIREKSI' | 'OWNER' | 'VENDOR' | 'INTERNAL_ADMIN' | 'NONE';

export type FactSourceType = 'DOKUMEN_FAKTA' | 'DUGAAN_SISTEM' | 'KOREKSI_USER';

export interface StructuredFact {
  key: string;
  label: string;
  value: string;
  sourceType: FactSourceType;
  confidence?: number; // 0 to 1
  pageOrLocation?: string;
}

export interface DocumentFileAttachment {
  id: string;
  fileName: string;
  fileSize: number; // in bytes
  fileType: string;
  uploadedAt: string;
  fileRole: 'ASLI' | 'REVISI' | 'SCAN_BASAH' | 'LAMPIRAN' | 'SURAT_BALASAN' | 'BUKTI_FOTO';
  storageLocation: string; // e.g., 'Google Drive: /PT UTP/PRJ-BDG/Memo/'
  driveFileId?: string;
  textSnippet?: string;
  previewUrl?: string;
}

export interface DocumentRelation {
  targetDocId: string;
  targetDocTitle: string;
  relationType: 'REVISI_DARI' | 'BALASAN_DARI' | 'LAMPIRAN_DARI' | 'SURAT_PENGANTAR';
  isConfirmed: boolean; // if false, suggested by system
}

export interface ActivityLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  details?: string;
}

export interface DocumentRecord {
  id: string;
  projectId: ProjectId;
  title: string;
  documentNumber: string;
  documentDate: string;
  category: DocumentCategory;
  
  // Workflow & Kanban
  isActionable: boolean; // true = shows on Kanban; false = stored purely as reference/memory
  kanbanStatus: KanbanStatus;
  waitingParty: WaitingParty;
  waitingPersonName?: string;
  requiredApproval?: string;
  deadline?: string;
  followUpDate?: string;
  
  // Executive Content
  summary: string;
  nextAction: string;
  
  // Specific domain data (e.g. Manpower, Material, Finance)
  manpowerDetails?: {
    changeType: 'PENAMBAHAN' | 'PENGURANGAN' | 'PERPINDAHAN';
    personnelNames: string[];
    position: string;
    headcount: number;
    placementLocation: string;
    effectiveDate: string;
    applicant: string;
    approver: string;
    decisionMentioned: string;
    actionRequired: string;
  };
  
  // Structured facts list
  facts: StructuredFact[];
  
  // Files linked to this single document memory
  files: DocumentFileAttachment[];
  
  // Document links
  relations: DocumentRelation[];
  
  // Audit trail
  activityLog: ActivityLogEntry[];
  
  // Archive flag
  isArchived: boolean;
  archivedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface ParseResult {
  title: string;
  documentNumber: string;
  documentDate: string;
  projectId: ProjectId;
  category: DocumentCategory;
  isActionable: boolean;
  waitingParty: WaitingParty;
  waitingPersonName?: string;
  requiredApproval?: string;
  deadline?: string;
  followUpDate?: string;
  summary: string;
  nextAction: string;
  facts: StructuredFact[];
  manpowerDetails?: DocumentRecord['manpowerDetails'];
  suggestedRelation?: {
    targetDocId: string;
    targetDocTitle: string;
    relationType: DocumentRelation['relationType'];
  };
}

import { DocumentCategory, DocumentRecord, ParseResult, ProjectId, StructuredFact } from '../types';

export interface FileIngestionInput {
  file: File;
  overrideProjectId?: ProjectId;
  previewUrl?: string;
  extractedText?: string;
  detectedRole?: 'ASLI' | 'REVISI' | 'SCAN_BASAH' | 'LAMPIRAN' | 'SURAT_BALASAN' | 'BUKTI_FOTO';
}

export function parseDocumentFile(
  input: FileIngestionInput,
  _existingDocs: DocumentRecord[]
): ParseResult {
  const fileName = input.file.name;
  const lowerName = fileName.toLowerCase();
  const projectId: ProjectId = input.overrideProjectId || 'ALL';

  // Filename hints are provisional classifications, never evidence of file content.
  let category: DocumentCategory = 'SURAT_KORESPONDENSI';
  if (/manpower|tenaga|personel|pekerja/.test(lowerName)) category = 'MEMO_MANPOWER';
  else if (/rpb|material|semen|besi/.test(lowerName)) category = 'RPB_MATERIAL';
  else if (/approval|spek|spesifikasi|persetujuan/.test(lowerName)) category = 'APPROVAL_SPEK';
  else if (/kasbon|rpd|keuangan|nota|kwitansi/.test(lowerName)) category = 'RPD_KEUANGAN';
  else if (/sewa|kontrak|perjanjian|kontrakan/.test(lowerName)) category = 'KONTRAK_SEWA';
  else if (/scan|basah|ttd|signed/.test(lowerName)) category = 'SCAN_TANDATANGAN';
  else if (/sop|pedoman|katalog|standar/.test(lowerName)) category = 'REFERENSI_STANDAR';

  const facts: StructuredFact[] = [
    { key: 'nama_asli_file', label: 'Nama File Asli', value: fileName,
      sourceType: 'DOKUMEN_FAKTA', pageOrLocation: 'Metadata berkas; bukan isi dokumen' },
    { key: 'ukuran_file', label: 'Ukuran Berkas', value: `${(input.file.size / 1024).toFixed(1)} KB`,
      sourceType: 'DOKUMEN_FAKTA', pageOrLocation: 'Metadata berkas; bukan isi dokumen' },
    { key: 'kategori_dugaan', label: 'Kategori sementara (perlu konfirmasi)', value: category,
      sourceType: 'DUGAAN_SISTEM', pageOrLocation: 'Petunjuk nama berkas saja' }
  ];
  if (projectId !== 'ALL') {
    facts.push({ key: 'proyek_dipilih', label: 'Proyek pilihan pengguna', value: projectId,
      sourceType: 'KOREKSI_USER', pageOrLocation: 'Pilihan proyek saat unggah' });
  }

  // Only accept a literal match from supplied text; never generate an official number.
  const text = input.extractedText || '';
  const match = text.match(/\b\d{2,4}\/[A-Z0-9-]+\/[A-Z0-9-]+\/[IVXLCDM0-9]+\/\d{4}\b/i);
  const documentNumber = match?.[0] || '';
  if (match) {
    facts.push({ key: 'nomor_dokumen', label: 'Nomor Dokumen', value: documentNumber,
      sourceType: 'DOKUMEN_FAKTA', pageOrLocation: `Teks berkas, karakter ${match.index}: ${documentNumber}` });
  }

  return {
    title: fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim(),
    documentNumber,
    documentDate: '',
    projectId,
    category,
    isActionable: false,
    waitingParty: 'NONE',
    summary: '',
    nextAction: '',
    facts
  };
}

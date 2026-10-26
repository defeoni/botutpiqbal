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
  existingDocs: DocumentRecord[]
): ParseResult {
  const fileName = input.file.name;
  const lowerName = fileName.toLowerCase();
  const text = (input.extractedText || '').toLowerCase();
  const combined = `${lowerName} ${text}`;

  // 1. Detect Project
  let detectedProject: ProjectId = input.overrideProjectId && input.overrideProjectId !== 'ALL' 
    ? input.overrideProjectId 
    : 'PRJ-BDG';

  if (!input.overrideProjectId || input.overrideProjectId === 'ALL') {
    if (combined.includes('bdg') || combined.includes('bandung') || combined.includes('asia afrika')) {
      detectedProject = 'PRJ-BDG';
    } else if (combined.includes('ckr') || combined.includes('cikarang') || combined.includes('deltamas') || combined.includes('gudang')) {
      detectedProject = 'PRJ-CKR';
    } else if (combined.includes('ikn') || combined.includes('kemenko') || combined.includes('nusantara') || combined.includes('penajam')) {
      detectedProject = 'PRJ-IKN';
    } else if (combined.includes('ho') || combined.includes('head office') || combined.includes('pusat') || combined.includes('jakarta')) {
      detectedProject = 'PRJ-HO';
    }
  }

  // 2. Detect Category
  let category: DocumentCategory = 'SURAT_KORESPONDENSI';
  let isActionable = true;

  if (lowerName.includes('manpower') || lowerName.includes('tenaga') || lowerName.includes('personel') || lowerName.includes('pekerja')) {
    category = 'MEMO_MANPOWER';
  } else if (lowerName.includes('rpb') || lowerName.includes('material') || lowerName.includes('semen') || lowerName.includes('besi')) {
    category = 'RPB_MATERIAL';
  } else if (lowerName.includes('approval') || lowerName.includes('spek') || lowerName.includes('spesifikasi') || lowerName.includes('persetujuan')) {
    category = 'APPROVAL_SPEK';
  } else if (lowerName.includes('kasbon') || lowerName.includes('rpd') || lowerName.includes('keuangan') || lowerName.includes('nota') || lowerName.includes('kwitansi')) {
    category = 'RPD_KEUANGAN';
  } else if (lowerName.includes('sewa') || lowerName.includes('kontrak') || lowerName.includes('perjanjian') || lowerName.includes('kontrakan')) {
    category = 'KONTRAK_SEWA';
  } else if (lowerName.includes('scan') || lowerName.includes('basah') || lowerName.includes('ttd') || lowerName.includes('signed')) {
    category = 'SCAN_TANDATANGAN';
  } else if (lowerName.includes('sop') || lowerName.includes('pedoman') || lowerName.includes('katalog') || lowerName.includes('standar')) {
    category = 'REFERENSI_STANDAR';
    isActionable = false; // Pure reference, no Kanban card
  }

  // 3. Extract Document Number
  let docNumber = '';
  const numRegex = /(\d{2,4}\/[A-Z0-9-]+\/[A-Z0-9-]+\/[IVXLCDM0-9]+\/\d{4})/i;
  const matchNum = fileName.match(numRegex) || (input.extractedText && input.extractedText.match(numRegex));
  if (matchNum) {
    docNumber = matchNum[1].toUpperCase();
  } else {
    // Generate clean plausible fallback number
    const rand = Math.floor(100 + Math.random() * 900);
    const projCode = detectedProject.replace('PRJ-', '');
    docNumber = `${rand}/MEMO-UTP/${projCode}/X/2026`;
  }

  // 4. Clean readable title
  let cleanTitle = fileName
    .replace(/\.[^/.]+$/, '') // remove ext
    .replace(/[_-]+/g, ' ')
    .trim();

  // Capitalize title
  cleanTitle = cleanTitle.charAt(0).toUpperCase() + cleanTitle.slice(1);

  // 5. Detect structured facts and Manpower specifics
  const facts: StructuredFact[] = [
    {
      key: 'nama_asli_file',
      label: 'Nama File Asli',
      value: fileName,
      sourceType: 'DOKUMEN_FAKTA'
    },
    {
      key: 'ukuran_file',
      label: 'Ukuran Berkas',
      value: `${(input.file.size / 1024).toFixed(1)} KB`,
      sourceType: 'DOKUMEN_FAKTA'
    },
    {
      key: 'proyek_terdeteksi',
      label: 'Proyek',
      value: detectedProject,
      sourceType: input.overrideProjectId ? 'KOREKSI_USER' : 'DUGAAN_SISTEM'
    }
  ];

  let manpowerDetails: ParseResult['manpowerDetails'] = undefined;
  let waitingParty: ParseResult['waitingParty'] = 'PM';
  let waitingPersonName = 'Project Manager';
  let requiredApproval = 'PM & Konsultan MK';
  let summary = `Dokumen ${cleanTitle} telah diarsipkan ke memori proyek ${detectedProject}.`;
  let nextAction = 'Periksa rincian dokumen dan pastikan tindak lanjut terdistribusi.';
  const today = new Date().toISOString().split('T')[0];
  const followUpDate = new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0];
  const deadline = new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0];

  if (category === 'MEMO_MANPOWER') {
    waitingParty = 'PM';
    waitingPersonName = detectedProject === 'PRJ-BDG' ? 'Ir. Bambang Sugiarto (PM)' : 'Project Manager';
    requiredApproval = 'Paraf PM & Persetujuan Direksi HO';
    summary = 'Pengajuan penambahan tenaga kerja operasional lapangan untuk mendukung akselerasi target pekerjaan fisik.';
    nextAction = 'Menunggu tanda tangan dan verifikasi PM sebelum diajukan ke Direksi/HO Logistik.';
    
    // Manpower facts
    manpowerDetails = {
      changeType: 'PENAMBAHAN',
      personnelNames: ['Personel Mandor & Teknisi ME'],
      position: 'Teknisi Lapangan / Supervisor',
      headcount: 3,
      placementLocation: detectedProject === 'PRJ-BDG' ? 'Apartemen Grand Asia Afrika Lt. 18-24' : 'Area Konstruksi Site',
      effectiveDate: '2026-11-01',
      applicant: 'Admin Proyek Lapangan (Iqbal)',
      approver: waitingPersonName,
      decisionMentioned: 'Masih berupa usulan resmi, belum diparaf PM',
      actionRequired: 'Menunggu review alokasi anggaran dan tanda tangan fisik PM'
    };

    facts.push(
      { key: 'jenis_perubahan', label: 'Jenis Perubahan', value: 'Penambahan Tenaga Kerja', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'estimasi_personel', label: 'Estimasi Personel', value: '3-4 Orang', sourceType: 'DUGAAN_SISTEM' },
      { key: 'status_keputusan', label: 'Status Keputusan', value: 'Usulan (Belum Disetujui PM)', sourceType: 'DOKUMEN_FAKTA' }
    );
  } else if (category === 'SURAT_KORESPONDENSI') {
    waitingParty = 'MK';
    waitingPersonName = 'Konsultan Pengawas MK';
    summary = `Surat korespondensi perihal ${cleanTitle} terkirim.`;
    nextAction = 'Pantau surat balasan resmi dari MK/Owner dalam kurun waktu 3 hari kerja.';
    facts.push(
      { key: 'status_balasan', label: 'Status Balasan', value: 'Belum Ada Balasan Resmi', sourceType: 'DUGAAN_SISTEM' }
    );
  } else if (category === 'RPB_MATERIAL' || category === 'APPROVAL_SPEK') {
    waitingParty = 'MK';
    waitingPersonName = 'Team Leader Konsultan MK';
    requiredApproval = 'MK & Site Engineer Owner';
    summary = `Pengajuan material / spesifikasi teknis untuk persetujuan konsultan.`;
    nextAction = 'Koordinasi uji lab material dan tindak lanjuti lembar tanda tangan approval.';
  } else if (category === 'RPD_KEUANGAN' || category === 'KONTRAK_SEWA') {
    waitingParty = 'HO_DIREKSI';
    waitingPersonName = 'Ibu Siti Rahmawati (Finance HO)';
    requiredApproval = 'PM & Direktur Keuangan HO';
    summary = `Pengajuan kasbon / sewa fasilitas penunjang proyek.`;
    nextAction = 'Kirimkan berkas bukti fisik atau kwitansi asli ke Finance HO.';
  }

  // 6. Check for potential links to existing documents
  let suggestedRelation: ParseResult['suggestedRelation'] = undefined;
  for (const doc of existingDocs) {
    if (doc.projectId !== detectedProject) continue;

    // Check if filename suggests a scan of existing doc
    if (lowerName.includes('scan') || lowerName.includes('signed') || lowerName.includes('basah')) {
      if (doc.documentNumber && lowerName.includes(doc.documentNumber.toLowerCase())) {
        suggestedRelation = {
          targetDocId: doc.id,
          targetDocTitle: doc.title,
          relationType: 'REVISI_DARI'
        };
        break;
      }
    }
    // Check if filename suggests a reply
    if (lowerName.includes('balasan') || lowerName.includes('jawaban')) {
      if (doc.category === 'SURAT_KORESPONDENSI' || doc.category === 'APPROVAL_SPEK') {
        suggestedRelation = {
          targetDocId: doc.id,
          targetDocTitle: doc.title,
          relationType: 'BALASAN_DARI'
        };
        break;
      }
    }
  }

  return {
    title: cleanTitle,
    documentNumber: docNumber,
    documentDate: today,
    projectId: detectedProject,
    category,
    isActionable,
    waitingParty,
    waitingPersonName,
    requiredApproval,
    deadline,
    followUpDate,
    summary,
    nextAction,
    facts,
    manpowerDetails,
    suggestedRelation
  };
}

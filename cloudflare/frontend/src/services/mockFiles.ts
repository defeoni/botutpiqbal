import { ProjectInfo, DocumentRecord } from '../types';

export const INITIAL_PROJECTS: ProjectInfo[] = [
  {
    id: 'PRJ-BDG',
    code: 'BDG-01',
    name: 'Apartemen Grand Asia Afrika Bandung',
    location: 'Jl. Karapitan No. 1, Bandung',
    pmName: 'Ir. Bambang Sugiarto',
    mkName: 'PT Ciriajasa Cipta Mandiri',
    ownerName: 'PT Grha Buana Indah',
    urgency: 'TINGGI',
    activeCardsCount: 3,
  },
  {
    id: 'PRJ-CKR',
    code: 'CKR-02',
    name: 'Gudang Logistik E-Commerce Cikarang',
    location: 'Kawasan Industri GIIC Deltamas, Cikarang',
    pmName: 'Hendra Kurniawan, S.T.',
    mkName: 'PT Indokonsult Pratama',
    ownerName: 'PT Mega Logistik Nusantara',
    urgency: 'SEDANG',
    activeCardsCount: 2,
  },
  {
    id: 'PRJ-IKN',
    code: 'IKN-03',
    name: 'Gedung Kantor Kemenko 3 IKN Nusantara',
    location: 'KIPP Zona 1A, IKN Penajam Paser Utara',
    pmName: 'Dr. Ir. Denny Wahyudi',
    mkName: 'PT Virama Karya (Persero)',
    ownerName: 'BPPW IKN / Kementerian PUPR',
    urgency: 'TINGGI',
    activeCardsCount: 4,
  },
  {
    id: 'PRJ-HO',
    code: 'HO-UTP',
    name: 'Head Office & Logistik Pusat Jakarta',
    location: 'Jl. TB Simatupang No. 88, Jakarta Selatan',
    pmName: 'Direktur Operasional (Pak Iqbal)',
    mkName: '-',
    ownerName: 'Internal PT UTP',
    urgency: 'NORMAL',
    activeCardsCount: 1,
  },
];

export const INITIAL_DOCUMENTS: DocumentRecord[] = [
  {
    id: 'DOC-BDG-042',
    projectId: 'PRJ-BDG',
    title: 'Memo Penambahan Manpower ME & Supervisor Sipil Tower B',
    documentNumber: '042/MEMO-UTP/BDG/X/2026',
    documentDate: '2026-10-22',
    category: 'MEMO_MANPOWER',
    isActionable: true,
    kanbanStatus: 'MENUNGGU',
    waitingParty: 'PM',
    waitingPersonName: 'Ir. Bambang Sugiarto (PM)',
    requiredApproval: 'Project Manager & MK Ciriajasa',
    deadline: '2026-10-28',
    followUpDate: '2026-10-26',
    summary: 'Pengajuan penambahan 4 personel teknis (2 Teknisi Elektrikal ME, 1 Supervisor Sipil Finis, 1 Safety Officer) untuk mengejar milestone penutupan fasad Lantai 18-24 Tower B sebelum musim hujan November 2026.',
    nextAction: 'Konfirmasi tanda tangan persetujuan PM dan paraf MK agar HO Logistik dapat mobilisasi personel dari Jakarta pada 1 November 2026.',
    manpowerDetails: {
      changeType: 'PENAMBAHAN',
      personnelNames: ['Ahmad Fauzi (Supervisor Sipil)', 'Dedi Supriyadi (ME Elektrikal)', 'Rian Hidayat (ME Plumbing)', 'Agus Setiawan (K3 Junior)'],
      position: 'Supervisor Finis & Teknisi ME',
      headcount: 4,
      placementLocation: 'Tower B Lt. 18-24 Proyek Bandung',
      effectiveDate: '2026-11-01',
      applicant: 'Iqbal (Admin Proyek UTP)',
      approver: 'Ir. Bambang Sugiarto (PM)',
      decisionMentioned: 'Masih berupa usulan resmi, belum ditandatangani PM',
      actionRequired: 'Menunggu review alokasi anggaran dan tanda tangan fisik PM'
    },
    facts: [
      { key: 'proyek', label: 'Proyek', value: 'Apartemen Grand Asia Afrika Bandung', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'jumlah_orang', label: 'Jumlah Personel', value: '4 Orang', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'posisi', label: 'Posisi/Jabatan', value: '2 ME, 1 Spv Sipil, 1 Safety Officer', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'tgl_efektif', label: 'Tanggal Efektif', value: '1 November 2026', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'posisi_berkas', label: 'Posisi Berkas Saat Ini', value: 'Di meja PM (Ir. Bambang Sugiarto)', sourceType: 'DUGAAN_SISTEM' },
      { key: 'lokasi_arsip', label: 'Lokasi File Drive', value: 'Google Drive: /PT UTP/PRJ-BDG/01_Memo/Memo_042_Manpower.docx', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-042-1',
        fileName: 'Memo_042_Penambahan_Manpower_Tower_B.docx',
        fileSize: 148200,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedAt: '2026-10-22T09:15:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/PRJ-BDG/01_Memo/',
        driveFileId: 'drv_bdg_memo_042_orig',
        textSnippet: 'MEMORANDUM INTERNAL PT UTAMA TUNGGAL PERKASA. Nomor: 042/MEMO-UTP/BDG/X/2026. Hal: Permohonan Penambahan Manpower Lapangan...'
      },
      {
        id: 'FILE-042-2',
        fileName: 'Rincian_Estimasi_Biaya_Upah_Lembur_TowerB.xlsx',
        fileSize: 84300,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedAt: '2026-10-22T09:18:00Z',
        fileRole: 'LAMPIRAN',
        storageLocation: 'Google Drive: /PT UTP/PRJ-BDG/01_Memo/Lampiran/',
        driveFileId: 'drv_bdg_memo_042_lamp'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-1', timestamp: '2026-10-22 09:15', actor: 'Admin Proyek', action: 'Upload Berkas Asli', details: 'Memo_042_Penambahan_Manpower_Tower_B.docx diunggah dari draft Word' },
      { id: 'ACT-2', timestamp: '2026-10-22 09:16', actor: 'Sistem Memory', action: 'Ekstraksi Fakta', details: 'Mendeteksi permohonan 4 manpower untuk Tower B, status menunggu persetujuan PM' },
      { id: 'ACT-3', timestamp: '2026-10-25 14:00', actor: 'Admin Proyek', action: 'Follow-up WhatsApp ke PM', details: 'Mengirimkan pesan ringkasan WA ke Ir. Bambang Sugiarto' }
    ],
    isArchived: false,
    createdAt: '2026-10-22T09:15:00Z',
    updatedAt: '2026-10-25T14:00:00Z'
  },
  {
    id: 'DOC-BDG-015',
    projectId: 'PRJ-BDG',
    title: 'Surat Permohonan Uji Material Beton K-400 & Approval Spesifikasi Pipa PVC',
    documentNumber: '088/SP-UTP/BDG/X/2026',
    documentDate: '2026-10-18',
    category: 'APPROVAL_SPEK',
    isActionable: true,
    kanbanStatus: 'SELESAI',
    waitingParty: 'NONE',
    waitingPersonName: 'Selesai (Sudah disetujui MK Ciriajasa)',
    requiredApproval: 'MK Ciriajasa & Site Architect Owner',
    deadline: '2026-10-24',
    summary: 'Pengajuan approval spesifikasi teknis pipa PVC conduit Wavin D-Class dan persetujuan jadwal uji tekan benda uji silinder beton K-400 batching plant Holcim.',
    nextAction: 'Arsip bukti fisik scan basah telah lengkap. Teruskan hasil approval ke tim logistik pengadaan.',
    facts: [
      { key: 'proyek', label: 'Proyek', value: 'Apartemen Grand Asia Afrika Bandung', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'nomor_surat', label: 'Nomor Surat UTP', value: '088/SP-UTP/BDG/X/2026', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'nomor_balasan', label: 'Nomor Balasan MK', value: 'MK-BDG-LTR-089 tertanggal 23 Okt 2026', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'merek_disetujui', label: 'Merek & Material Disetujui', value: 'Pipa Conduit Wavin D-Class & Beton Holcim K-400', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'status_scan', label: 'Scan Bertanda Tangan', value: 'Tersedia (Scan_Basah_Approval_MK_Ciriajasa_Signed.pdf)', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-015-1',
        fileName: 'Surat_088_Approval_Pipa_Beton_Bandung.pdf',
        fileSize: 312000,
        fileType: 'application/pdf',
        uploadedAt: '2026-10-18T11:00:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/PRJ-BDG/02_Surat_Keluar/',
        driveFileId: 'drv_bdg_surat_088_asli'
      },
      {
        id: 'FILE-015-2',
        fileName: 'Scan_Basah_Approval_MK_Ciriajasa_Signed.pdf',
        fileSize: 1845000,
        fileType: 'application/pdf',
        uploadedAt: '2026-10-24T16:20:00Z',
        fileRole: 'SCAN_BASAH',
        storageLocation: 'Google Drive: /PT UTP/PRJ-BDG/02_Surat_Masuk/Scan_Basah/',
        driveFileId: 'drv_bdg_scan_basah_088_signed',
        textSnippet: 'LEMBAR PENGESAHAN KONSULTAN MK. Disetujui dengan catatan toleransi pengetesan lab... TTD Ir. Hendra (Team Leader Ciriajasa) cap basah.'
      },
      {
        id: 'FILE-015-3',
        fileName: 'Surat_Balasan_MK_No089_Persetujuan_Spek.pdf',
        fileSize: 420000,
        fileType: 'application/pdf',
        uploadedAt: '2026-10-24T16:25:00Z',
        fileRole: 'SURAT_BALASAN',
        storageLocation: 'Google Drive: /PT UTP/PRJ-BDG/02_Surat_Masuk/',
        driveFileId: 'drv_bdg_balasan_089'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-B1', timestamp: '2026-10-18 11:00', actor: 'Admin Proyek', action: 'Upload Surat Pengajuan', details: 'Surat permohonan approval dikirimkan ke MK' },
      { id: 'ACT-B2', timestamp: '2026-10-24 16:20', actor: 'Admin Proyek', action: 'Upload Scan Bertanda Tangan Basah', details: 'Menghubungkan Scan_Basah_Approval_MK_Ciriajasa_Signed.pdf ke kartu yang sama' },
      { id: 'ACT-B3', timestamp: '2026-10-24 16:30', actor: 'Admin Proyek', action: 'Pindah ke Selesai', details: 'Tercatat selesai administratif setelah balasan fisik diterima' }
    ],
    isArchived: false,
    createdAt: '2026-10-18T11:00:00Z',
    updatedAt: '2026-10-24T16:30:00Z'
  },
  {
    id: 'DOC-IKN-019',
    projectId: 'PRJ-IKN',
    title: 'Surat Permohonan Izin Kerja Lembur Malam Pengecoran Kolom Zona 1A',
    documentNumber: '033/UTP-EXT/IKN/X/2026',
    documentDate: '2026-10-24',
    category: 'SURAT_KORESPONDENSI',
    isActionable: true,
    kanbanStatus: 'MENUNGGU',
    waitingParty: 'MK',
    waitingPersonName: 'Ir. Agus Wijaya (Virama Karya MK IKN)',
    requiredApproval: 'MK Virama Karya & Satgas PUPR IKN',
    deadline: '2026-10-27',
    followUpDate: '2026-10-26',
    summary: 'Permohonan izin pelaksanaan shift lembur malam (20.00 - 04.00 WITA) tanggal 27-29 Oktober 2026 untuk pekerjaan pengecoran massal kolam retensi dan kolom grid C1-C8 Gedung Kemenko 3.',
    nextAction: 'Surat ini belum ada balasannya! Segera konfirmasi izin lembur ke MK Virama Karya via WhatsApp atau koordinasi site meeting pagi.',
    facts: [
      { key: 'proyek', label: 'Proyek', value: 'Gedung Kantor Kemenko 3 IKN Nusantara', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'nomor_surat', label: 'Nomor Surat', value: '033/UTP-EXT/IKN/X/2026', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'status_balasan', label: 'Status Balasan Surat', value: 'BELUM ADA BALASAN dari MK', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'jam_kerja_lembur', label: 'Jadwal Lembur', value: '20.00 - 04.00 WITA (3 malam)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'lokasi_arsip', label: 'Lokasi File Drive', value: 'Google Drive: /PT UTP/PRJ-IKN/02_Surat_Keluar/Surat_033_Izin_Lembur.pdf', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-IKN-1',
        fileName: 'Surat_033_Permohonan_Izin_Lembur_Zona1A.pdf',
        fileSize: 480000,
        fileType: 'application/pdf',
        uploadedAt: '2026-10-24T14:30:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/PRJ-IKN/02_Surat_Keluar/',
        driveFileId: 'drv_ikn_surat_033',
        textSnippet: 'PT UTAMA TUNGGAL PERKASA. Nomor: 033/UTP-EXT/IKN/X/2026. Kepada Yth. Tim Leader PT Virama Karya (Persero) MK IKN...'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-IKN1', timestamp: '2026-10-24 14:30', actor: 'Admin Proyek', action: 'Upload Berkas Keluar', details: 'Surat izin lembur diunggah setelah ditandatangani PM Denny' },
      { id: 'ACT-IKN2', timestamp: '2026-10-24 14:32', actor: 'Sistem Memory', action: 'Deteksi Tenggat Kritis', details: 'Tenggat operasional 27 Okt 2026 terpasang otomatis' }
    ],
    isArchived: false,
    createdAt: '2026-10-24T14:30:00Z',
    updatedAt: '2026-10-24T14:32:00Z'
  },
  {
    id: 'DOC-CKR-008',
    projectId: 'PRJ-CKR',
    title: 'Memo Kasbon Operasional & Perjanjian Sewa Rumah Kontrakan Mess Pekerja Cikarang',
    documentNumber: '018/KASBON-MESS/CKR/X/2026',
    documentDate: '2026-10-23',
    category: 'KONTRAK_SEWA',
    isActionable: true,
    kanbanStatus: 'AKTIF',
    waitingParty: 'HO_DIREKSI',
    waitingPersonName: 'Ibu Siti Rahmawati (Finance & GA HO)',
    requiredApproval: 'PM Hendra & Finance Direksi HO',
    deadline: '2026-10-30',
    followUpDate: '2026-10-27',
    summary: 'Pencairan dana kasbon perpanjangan sewa kontrakan 2 unit mess tukang di Perum Cikarang Baru Blok B untuk periode Nov 2026 - April 2027 sebesar Rp 36.000.000,-.',
    nextAction: 'Kirimkan invoice asli dan draf perjanjian sewa yang sudah diparaf pemilik rumah ke Finance HO untuk transfer termin 1 sebelum 30 Oktober.',
    facts: [
      { key: 'proyek', label: 'Proyek', value: 'Gudang Logistik E-Commerce Cikarang', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'nilai_kontrak', label: 'Nilai Sewa Kontrakan', value: 'Rp 36.000.000 (6 Bulan / 2 Unit)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'pemilik_kontrakan', label: 'Nama Pemilik Rumah', value: 'H. Sudarsono (Cikarang Pusat)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'dokumen_terkait', label: 'Kelengkapan', value: 'KTP Pemilik, Kwitansi DP Rp 5.000.000, Draf Perjanjian Sewa', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-CKR-1',
        fileName: 'Memo_018_Kasbon_Sewa_Kontrakan_Pekerja.pdf',
        fileSize: 220000,
        fileType: 'application/pdf',
        uploadedAt: '2026-10-23T10:00:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/PRJ-CKR/03_Keuangan/Kasbon/',
        driveFileId: 'drv_ckr_memo_018'
      },
      {
        id: 'FILE-CKR-2',
        fileName: 'Draf_Perjanjian_Sewa_Rumah_Cikarang_Mess.docx',
        fileSize: 115000,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        uploadedAt: '2026-10-23T10:05:00Z',
        fileRole: 'LAMPIRAN',
        storageLocation: 'Google Drive: /PT UTP/PRJ-CKR/03_Keuangan/Perjanjian/',
        driveFileId: 'drv_ckr_perjanjian_sewa'
      },
      {
        id: 'FILE-CKR-3',
        fileName: 'Foto_Kwitansi_DP_Kontrakan_5Juta.jpg',
        fileSize: 890000,
        fileType: 'image/jpeg',
        uploadedAt: '2026-10-23T10:08:00Z',
        fileRole: 'BUKTI_FOTO',
        storageLocation: 'Google Drive: /PT UTP/PRJ-CKR/03_Keuangan/Bukti_Nota/',
        driveFileId: 'drv_ckr_kwitansi_dp'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-C1', timestamp: '2026-10-23 10:00', actor: 'Admin Proyek', action: 'Upload Berkas Kasbon', details: 'Pengajuan kasbon sewa mess pekerja diunggah' },
      { id: 'ACT-C2', timestamp: '2026-10-24 11:15', actor: 'Finance HO', action: 'Verifikasi Draf', details: 'Draf perjanjian disetujui, menunggu jadwal transfer batch Jumat' }
    ],
    isArchived: false,
    createdAt: '2026-10-23T10:00:00Z',
    updatedAt: '2026-10-24T11:15:00Z'
  },
  {
    id: 'DOC-IKN-005',
    projectId: 'PRJ-IKN',
    title: 'RPB Pengadaan Besi Beton Ulir D16 & D25 Krakatau Steel Volume 120 Ton',
    documentNumber: 'RPB-IKN-2026-10-09',
    documentDate: '2026-10-21',
    category: 'RPB_MATERIAL',
    isActionable: true,
    kanbanStatus: 'AKTIF',
    waitingParty: 'VENDOR',
    waitingPersonName: 'PT Krakatau Steel & Ekspedisi Balikpapan',
    requiredApproval: 'PM Denny & Logistik HO Jakarta',
    deadline: '2026-11-05',
    summary: 'Rencana Pengadaan Bahan (RPB) batch 4 untuk pemenuhan tulangan struktur balok dan plat lantai 3-5 gedung Kemenko 3. Pengiriman via tongkang rute Tanjung Priok - Pelabuhan Semayang Balikpapan.',
    nextAction: 'Pantau posisi bongkar muat kapal tongkang di dermaga Balikpapan dan siapkan surat jalan timbang site IKN.',
    facts: [
      { key: 'proyek', label: 'Proyek', value: 'Gedung Kantor Kemenko 3 IKN Nusantara', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'merek_material', label: 'Merek & Spesifikasi', value: 'Besi Beton Ulir BJTS 420B Krakatau Steel (KS)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'volume', label: 'Volume Barang', value: '120 Ton (D16: 50 Ton, D25: 70 Ton)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'jadwal_tiba', label: 'Target Tiba di Site', value: '03 November 2026', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-RPB-1',
        fileName: 'RPB_Besi_Beton_120Ton_KrakatauSteel_IKN.xlsx',
        fileSize: 185000,
        fileType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        uploadedAt: '2026-10-21T08:30:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/PRJ-IKN/04_Material_RPB/',
        driveFileId: 'drv_ikn_rpb_besi'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-R1', timestamp: '2026-10-21 08:30', actor: 'Admin Proyek', action: 'Upload RPB Disetujui', details: 'RPB besi beton diunggah' },
      { id: 'ACT-R2', timestamp: '2026-10-23 09:00', actor: 'Logistik HO', action: 'PO Diterbitkan ke Pabrik', details: 'PO Krakatau Steel telah diterbitkan' }
    ],
    isArchived: false,
    createdAt: '2026-10-21T08:30:00Z',
    updatedAt: '2026-10-23T09:00:00Z'
  },
  {
    id: 'DOC-REF-001',
    projectId: 'PRJ-HO',
    title: 'Standar Prosedur Operasional K3 & Keselamatan Lapangan PT UTP Rev-4',
    documentNumber: 'SOP-UTP-K3-2026',
    documentDate: '2026-01-15',
    category: 'REFERENSI_STANDAR',
    isActionable: false, // DOES NOT SHOW ON KANBAN - Pure Project Memory / Reference
    kanbanStatus: 'SELESAI',
    waitingParty: 'NONE',
    summary: 'Pedoman standar baku keselamatan kerja (K3) konstruksi PT Utama Tunggal Perkasa: APD wajib, izin kerja ketinggian, mitigasi kebakaran, dan pelaporan insiden.',
    nextAction: 'Sebagai rujukan lintas proyek. Tidak ada tindak lanjut aktif.',
    facts: [
      { key: 'cakupan', label: 'Cakupan Dokumen', value: 'Lintas Semua Proyek PT UTP', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'versi', label: 'Versi Dokumen', value: 'Revisi 4.0 (Berlaku 2026 - 2028)', sourceType: 'DOKUMEN_FAKTA' },
      { key: 'penerbit', label: 'Penerbit Dokumen', value: 'Divisi HSE Head Office Jakarta', sourceType: 'DOKUMEN_FAKTA' }
    ],
    files: [
      {
        id: 'FILE-REF-1',
        fileName: 'SOP_K3_Keselamatan_Kerja_PT_UTP_Rev4.pdf',
        fileSize: 4200000,
        fileType: 'application/pdf',
        uploadedAt: '2026-01-15T08:00:00Z',
        fileRole: 'ASLI',
        storageLocation: 'Google Drive: /PT UTP/00_Referensi_Umum/HSE/',
        driveFileId: 'drv_ref_sop_k3'
      }
    ],
    relations: [],
    activityLog: [
      { id: 'ACT-REF1', timestamp: '2026-01-15 08:00', actor: 'HSE HO', action: 'Publikasi Referensi Standar', details: 'SOP K3 resmi diunggah sebagai master referensi' }
    ],
    isArchived: false,
    createdAt: '2026-01-15T08:00:00Z',
    updatedAt: '2026-01-15T08:00:00Z'
  }
];

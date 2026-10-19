# Material dan workspace

Semua endpoint wajib sesi pemilik. Mutasi terkunci, ID draf stabil, versi optimistis; konflik mempertahankan isian. Audit gagal setelah penyimpanan dilaporkan sebagai warning, bukan simpan batal.

Material aktif kecuali Script Property UTP_MATERIAL_DRAFTS_ENABLED=false. Bootstrap capabilities.materialDrafts/materialWorkflow menunjukkan kemampuan aktual. saveMaterialDraft khusus DRAFT contract v1. materialCommand menerima id,version,operation SAVE/SUBMIT/FINAL_FILE/FINALIZE/REVISION/FULFILLMENT/ARRIVAL serta record/party/reason/fileId/coveredItemIds/confirmed/pin sesuai operasi.

Server memvalidasi klasifikasi/otoritas/keputusan per item. Snapshot awal dan history tidak dipercaya dari klien. REV hanya melalui REVISION. Final HO harus file nyata terdaftar dengan cakupan item; final parsial mempertahankan item ditolak/ditunda. PIN untuk perubahan terlindungi. Data legacy tidak dikonversi diam-diam. Simulasi tetap terpisah dalam memori.

apiWorkspace: list/save/delete/upload/summary, module tasks/finance/archives/people/attendance/rpd. Penyimpanan pada sheet workspace*, ID/versi stabil, soft delete dan perubahan RPD diajukan memerlukan PIN. Total RPD dihitung server. Status pengajuan/review adalah catatan admin, bukan pengiriman atau persetujuan otomatis. File privat, maksimal 5 MB.

apiDashboard menggabungkan ringkasan server dengan warning per sumber. apiResetProject memerlukan PIN dan confirmation=RESET PROYEK; mengarsipkan data proyek, mempertahankan master, file Drive, Memo/RPB/RPD dan kredensial.

Penghapusan riwayat RPB memakai apiDeleteRpbHistory(id,confirmation,pin,token), confirmation HAPUS RPB atau HAPUS SEMUA RPB untuk id=*. Data ditandai deletedAt dan dikeluarkan dari daftar aktif; tracking dan snapshot lama disimpan, file Drive tidak dibuang. Nomor dan revisi tetap menghitung riwayat terhapus agar tidak digunakan ulang. Tracking/revisi baru menolak ID yang dihapus. Master RPB difilter sebelum pagination 25 baris; total hasil dan total master ditampilkan.

RPD dan catatan workspace (termasuk Nota/Keuangan sebagai catatan LPD) memakai soft delete versi-optimistis dengan PIN. Hapus semua hanya memproses ID/versi yang dimuat pada modul tersebut, termasuk hasil tersembunyi oleh pencarian, berhenti pada konflik/kegagalan dan menampilkan jumlah yang sudah terhapus. File Drive dan audit dipertahankan; ini bukan penghapusan dokumen LPD resmi tersendiri. apiHardReset hanya menghapus riwayat/file Memo yang tercatat serta counter Memo; tidak menelusuri folder arsip bersama atau membersihkan modul lain.

Pencarian material menerima classification BRANDED/GENERIC/UNKNOWN, merek dan kelompok persis, tipe mengandung, kata pencarian dan approvedOnly. GENERIC hanya untuk klasifikasi eksplisit; merek kosong tidak otomatis generik. Filter diterapkan sebelum pagination 50 baris dan total dihitung dari seluruh hasil.

Kanban: satu kartu per permintaan, tahap Draf → Review → Siap dipenuhi → Menunggu penerimaan → Diterima; pembatalan ditampilkan terpisah. Geser memakai tindakan bisnis yang sama, bukan menulis status langsung. FULFILLMENT mengharuskan daftar final, confirmed=true, sumber konfirmasi dan PIN; menyimpan fulfillmentConfirmed/fulfillmentAt/fulfillmentNote. Perubahan review, file final atau penetapan final ulang membatalkan konfirmasi penyediaan sebelumnya. Ini bukan stok/pembayaran/kedatangan. ARRIVAL tetap mendukung catatan kedatangan nyata dari menu lama; arrivalDate terpisah dari timestamp audit.

Rekap approval memakai F.A1-03A asli, sepuluh catatan aktif per file. Tanggal arsip bukan tanggal pengajuan. Keputusan disalin beserta otoritas; tidak menghasilkan persetujuan baru. Snapshot dan tautan hasil dicatat di documentExports; riwayat rekap tidak bergantung pada satu record approval. PDF rekap ditahan sampai konversi skala cetak 75% diverifikasi.

Telegram: jika webhook tercatat ditolak 401/403 dan ada antrean, koneksi beralih ke getUpdates melalui trigger tiap menit. deleteWebhook tidak membuang antrean. Offset disimpan setelah handler berhasil; handler gagal mempertahankan pesan untuk dicoba ulang. Chat pribadi dan OWNER_TELEGRAM_ID tetap diperiksa oleh handler yang sama. Mode polling tidak dipaksa kembali ke webhook oleh /setwebhook. Status polling belum dianggap berjalan sebelum ada pemeriksaan trigger berhasil.

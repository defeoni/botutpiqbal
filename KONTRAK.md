# Material dan workspace

Semua endpoint wajib sesi pemilik. Mutasi terkunci, ID draf stabil, versi optimistis; konflik mempertahankan isian. Audit gagal setelah penyimpanan dilaporkan sebagai warning, bukan simpan batal.

Material aktif kecuali Script Property UTP_MATERIAL_DRAFTS_ENABLED=false. Bootstrap capabilities.materialDrafts/materialWorkflow menunjukkan kemampuan aktual. saveMaterialDraft khusus DRAFT contract v1. materialCommand menerima id,version,operation SAVE/SUBMIT/FINAL_FILE/FINALIZE/REVISION/ARRIVAL serta record/party/reason/fileId/coveredItemIds/confirmed/pin sesuai operasi.

Server memvalidasi klasifikasi/otoritas/keputusan per item. Snapshot awal dan history tidak dipercaya dari klien. REV hanya melalui REVISION. Final HO harus file nyata terdaftar dengan cakupan item; final parsial mempertahankan item ditolak/ditunda. PIN untuk perubahan terlindungi. Data legacy tidak dikonversi diam-diam. Simulasi tetap terpisah dalam memori.

apiWorkspace: list/save/delete/upload/summary, module tasks/finance/archives/people/attendance/rpd. Penyimpanan pada sheet workspace*, ID/versi stabil, soft delete dan perubahan RPD diajukan memerlukan PIN. Total RPD dihitung server. Status pengajuan/review adalah catatan admin, bukan pengiriman atau persetujuan otomatis. File privat, maksimal 5 MB.

apiDashboard menggabungkan ringkasan server dengan warning per sumber. apiResetProject memerlukan PIN dan confirmation=RESET PROYEK; mengarsipkan data proyek, mempertahankan master, file Drive, Memo/RPB/RPD dan kredensial.

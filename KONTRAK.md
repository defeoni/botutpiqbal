# Draf Material v1

## API

Bootstrap menambah capabilities.materialDrafts berupa boolean; true hanya bila Script Property UTP_MATERIAL_DRAFTS_ENABLED === 'true'. Default false. Tidak mengubah property otomatis atau deploy.

Action saveMaterialDraft menerima {record}. Record memiliki id stabil (local UUID frontend), version:0 untuk baru atau integer versi server saat edit, itemContractVersion:1, status:DRAFT, initialSnapshot:null, revision:1, revisions:[], files:[], arrived:false, title,number,date,note,items.

Item: id,code,name,brand,model,unit,quantity,group,family,classification (BRANDED/GENERIC/UNKNOWN/OWNER/OTHER),isTemporary,requiredAuthority (PM/MK/HO, atau string kosong untuk OWNER/OTHER), decisions:{PM:{status:PENDING},MK:{status:PENDING},HO:{status:PENDING}},exceptionReason,note,finalFileId:'',supplyConfirmed:false. Brand kosong boleh UNKNOWN; GENERIC eksplisit hanya brand kosong. Draf tidak membutuhkan approval aktif/alasan pengecualian. Dilarang menyimpan keputusan non-PENDING, bukti final, snapshot/revisi/status live melalui action ini. Minimal satu item, title/date valid. Jangan mengubah perilaku endpoint save legacy.

Domain menyediakan utpValidateMaterialDraft_(source,existing,context) untuk normalisasi/validasi. ID,version,createdAt,updatedAt dikelola adapter; domain mengembalikan itemContractVersion:1 dan field draf lengkap. existing jika ada harus contract v1, DRAFT dan belum initialSnapshot; jangan konversi data legacy otomatis. History dibuat server via utpRecordRequestSave_; jangan percaya history kiriman klien. Tetap revisi 1 tanpa initial snapshot.

Adapter saveMaterialDraft wajib auth, capability gate dan lock existing API. Baca record saat lock; jika id sudah ada dan version tidak cocok -> {conflict:true,record:current}; jika version>0 tetapi record hilang, error jangan recreate. ID baru harus stabil dari klien (bukan UUID server baru) agar retry respons hilang tidak menggandakan dokumen. Validasi normalisasi domain lalu utpRecordRequestSave_ dan utpWrite_. Return {record,warnings:[]}. Jika audit gagal setelah primary tersimpan -> return {record:readback,warnings:[pesan audit],recordSaved:true}; klien tampilkan warning, jangan anggap batal. Gate capability di server juga, bukan UI saja.

Frontend produksi: tetap read-only jika capability false; bila true hanya new-request/add-master/add-temporary/use-item/edit-item/remove-item/save-request untuk draft v1, plus back/open/detail. Semua workflow lain live disabled. read RPC allowlist ditambah saveMaterialDraft pada jalur khusus dengan gate. Jangan menyamarkan API error memakai seed. storeEditor existing preview tetap sinkron. Tambah saveLiveDraft async; busy mencegah duplicate, failure mempertahankan isian; respons tidak menimpa editor/sesi lain (epoch + identitas). Konflik simpan mempertahankan local input dan menampilkan perbandingan; jangan menerapkan perubahan status/revision. Simpan dirty sebelum pindah/open sesuai existing. Buka ulang v1 DRAFT editable hanya jika capability true; legacy/nonDRAFT tetap read-only. Label memori hanya preview, produksi server. new client draft id UUID stabil. Backend tidak otomatis enable.


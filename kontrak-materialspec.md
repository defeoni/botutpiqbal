# Kontrak Backend Spek

```text
ENDPOINT
apiMaterialSpec(action, payload, token)

AUTENTIKASI
- Semua action memanggil requireAuthorized_(token).
- MaterialSpec tidak mengubah helper autentikasi.

DOMAIN
- Spek selalu terikat satu projectId aktif yang sudah tersimpan.
- projectId kosong, "all", "legacy", proyek tidak dikenal, dan proyek archived ditolak.
- Spek tidak memiliki bulan, periode, RAP, quantity total, subtotal, atau workflow Approval.
- Entity penyimpanan: "materialSpecs".

RECORD SPEK
{
  id: string,
  projectId: string,
  title: string,
  note: string,
  items: [
    {
      catalogCode: string,
      name: string,
      specification: string,
      unit: string,
      brands: string[],
      price: number | null,
      note: string
    }
  ],
  archived: false,

  // field internal yang ditambahkan helper penyimpanan/backend:
  version: number,
  createdAt: string,
  updatedAt: string,
  createFingerprint: string
}

FIELD INTERNAL
- createFingerprint adalah metadata backend.
- Frontend tidak perlu membuat atau mengubah createFingerprint.
- createFingerprint dipertahankan saat update.

HARGA
- price kosong/null/whitespace -> null.
- 0 diterima.
- Angka negatif ditolak.
- Format seperti "1.000.000", "Rp100", atau teks nonangka ditolak.
- Nilai maksimal 1 triliun.

KANDIDAT MEREK
- brands adalah daftar.
- Maksimal 10 kandidat per item.
- Merek kosong boleh menghasilkan daftar kosong.
- Backend tidak menganggap merek kosong sebagai generik.

KATALOG
- Setiap catalogCode pada saveSpec wajib ditemukan di utpMaster_().
- Validasi dilakukan di server sebelum write.
- name/specification/unit dari request tetap divalidasi sebagai bagian record Spek.
- Dalam satu record Spek, kombinasi normalisasi catalogCode + specification tidak boleh duplikat.
- catalogCode sama dengan specification/ukuran berbeda tetap diperbolehkan.

ACTION: searchCatalog
REQUEST
{
  projectId: string,
  query?: string,
  limit?: number,
  offset?: number,

  // field filter lain yang memang didukung utpSearchItems_ dapat diteruskan,
  // tetapi MaterialSpec sendiri tidak menambah kontrak filter baru.
}

RESPONSE
{
  items: array,
  total: number,
  offset: number,
  limit: number,
  hasMore: boolean
}

CATATAN
- projectId wajib merupakan proyek aktif.
- Sumber katalog adalah utpMaster_().
- MaterialSpec memanggil utpSearchItems_(master, payload, []).
- Action ini tidak menulis Spek atau Approval.

ACTION: listSpecs
REQUEST
{
  projectId: string,
  query?: string,
  limit?: number,
  offset?: number
}

RESPONSE
{
  records: MaterialSpecRecord[],
  total: number,
  offset: number,
  limit: number,
  hasMore: boolean
}

ATURAN listSpecs
- Hanya record milik projectId yang diminta.
- Record archived tidak masuk karena memakai utpRead_(SPEK_ENTITY).
- limit minimum 1, maksimum 100, default 100.
- offset harus integer aman >= 0.
- query dinormalisasi dan dicari pada:
  title,
  note,
  item.name,
  item.catalogCode,
  item.specification,
  item.unit,
  item.brands[].

ACTION: saveSpec — CREATE
REQUEST
{
  projectId: string,
  record: MaterialSpecInput
}

- expectedVersion tidak dikirim pada create.

CREATE DENGAN ID CLIENT
- Jika record.id belum ada:
  record dibuat dengan ID tersebut.
- Jika ID sudah ada dan createFingerprint sama:
  dianggap retry create persisten.
  Response:
  {
    record: MaterialSpecRecord,
    deduplicated: true
  }
- Jika ID sudah ada tetapi fingerprint berbeda:
  error.
- Retry create tidak diperlakukan sebagai update.

CREATE TANPA ID
- Backend membuat ID dengan Utilities.getUuid().
- Sebelum membuat ID, backend mencari createFingerprint yang sama
  pada record aktif dalam projectId yang sama.
- Jika ditemukan:
  {
    record: MaterialSpecRecord,
    deduplicated: true
  }
- Dengan demikian idempotensi create tidak bergantung CacheService.

CREATE NORMAL BERHASIL
{
  record: MaterialSpecRecord
}

ACTION: saveSpec — UPDATE
REQUEST
{
  projectId: string,
  expectedVersion: number,
  record: {
    id: string,
    ...
  }
}

ATURAN UPDATE
- record.id wajib menunjuk record yang sudah ada.
- Record wajib milik projectId yang sama.
- Record archived tidak dapat diperbarui.
- expectedVersion wajib integer >= 1.
- Jika expectedVersion berbeda dari versi tersimpan:
  tidak ada write.

RESPONSE CONFLICT
{
  conflict: true,
  record: MaterialSpecRecordTerbaru
}

- Conflict bukan error transport.
- Conflict tidak menimpa data terbaru.
- Caller harus menangani conflict sebagai outcome bisnis.

UPDATE BERHASIL
{
  record: MaterialSpecRecord
}

UPDATE TERHADAP ID YANG TIDAK ADA
- Jika expectedVersion diberikan tetapi record.id tidak ditemukan:
  error.
- Backend tidak mengubah update yang hilang menjadi create terselubung.

IDEMPOTENSI PERSISTEN
- Tidak menggunakan CacheService.
- Tidak menggunakan utpHash_.
- Fingerprint dihitung lokal melalui:
  Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    JSON payload canonical,
    Utilities.Charset.UTF_8
  )
  lalu Utilities.base64Encode(...).

PAYLOAD CANONICAL FINGERPRINT
{
  projectId,
  title,
  note,
  items,
  archived: false
}

- id, version, createdAt, updatedAt, dan createFingerprint
  tidak menjadi input fingerprint.
- Nilai terlebih dahulu melalui normalisasi/validasi server.

PERILAKU utpWrite_
- utpWrite_ dapat:
  1. return record jika data + audit berhasil.
  2. throw error biasa jika write inti gagal.
  3. throw Error dengan error.recordSaved === true
     jika record sudah ditulis tetapi audit gagal.

AUDIT GAGAL SETELAH WRITE
- MaterialSpec menangkap hanya error.recordSaved === true.
- Backend kemudian memanggil:
  utpGet_("materialSpecs", record.id)
- Jika record dapat dibaca ulang:
  {
    record: recordYangTersimpan,
    warning: error.message
  }
- Tidak ada write kedua.
- Berlaku untuk create maupun update.
- Jika record tidak dapat dibaca ulang:
  backend melempar error keras.
- Backend tidak boleh melaporkan sukses palsu jika read-back gagal.

WRITE INTI GAGAL
- Jika error.recordSaved bukan true:
  error diteruskan.
- Tidak dikonversi menjadi warning/sukses.

LOCK
- saveSpec memakai LockService.getScriptLock().
- waitLock(30000).
- lock dilepas pada finally, termasuk conflict/error.

APPROVAL
- MaterialSpec tidak membuat, memperbarui, membaca keputusan,
  atau menetapkan status Approval.
```

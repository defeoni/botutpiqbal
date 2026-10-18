# Peta kerja BOT UTP IQBAL

Keputusan pengguna 18 Oktober 2026: burst AKTIF atas permintaan "gas mode burst sekarang". Maksimal 3 penulis saat burst diminta; Codex termasuk penulis jika ikut mengedit. Ini menggantikan batas lama 2 penulis. Agen analisis/review tidak dihitung penulis selama tidak mengedit.

## Batas berhenti terbaru

Pengguna menetapkan: setelah satu pekerjaan selesai, berhenti dan tunggu konfirmasi sebelum pekerjaan berikutnya. Ini mengungguli instruksi sebelumnya untuk lanjut otomatis. Backup hasil pekerjaan boleh diselesaikan; jangan mulai tahap review/revisi berikutnya tanpa konfirmasi. Burst tidak berarti pekerjaan tanpa batas.

## Prinsip

Kerjakan satu alur kecil dari input sampai data tersimpan dan dapat dibuka kembali. Jangan menyelesaikan seluruh backend sebelum mencoba sambungan frontend. Pakai Apps Script, Sheets/Drive dan struktur yang ada; tanpa framework, database, atau abstraksi tambahan sampai ada kebutuhan nyata.

Sumber utama: file Windows terbaru + GitHub yang dikelola Codex/VS Code. AI eksternal tidak diberi akses GitHub. Qwen Coder boleh edit salinan/lokal pada batas yang diberikan; hasil dari /workspace bukan perubahan otomatis pada Windows.

## Urutan dan bukti selesai

| Tahap | Hasil kecil | Bukti selesai |
|---|---|---|
| 1. Sepakati kontrak minimum | Bentuk data item, keputusan PM/MK/HO, lampiran/cakupan, version, snapshot dan error; cocokkan dengan fungsi existing | Satu contoh request/response dan daftar field yang disimpan; tidak ada keputusan bisnis baru terselip |
| 2. Simpan dan buka draf | Validasi domain + adapter Sheets + frontend save/detail untuk draf per item | Draf yang disimpan dapat dibuka lagi tanpa kehilangan klasifikasi, jumlah, otoritas atau isian; konflik tidak overwrite |
| 3. Review dan revisi | Keputusan per pihak, riwayat, snapshot awal dan revisi tersimpan | Reload tetap mempertahankan keputusan/riwayat; hanya Terbitkan Revisi menaikkan REV |
| 4. Bukti HO dan final | File Drive terdaftar, cakupan per item, finalisasi sebagian, konfirmasi kedatangan sesuai kontrak yang ada | Bukti salah cakupan ditolak; item ditolak/ditunda tetap tersimpan; tidak memalsukan barang datang |
| 5. Uji Google dan rilis | Target Apps Script, login/PIN, akses Sheets/Drive, alur perangkat berbeda dan pemulihan | Satu alur lengkap pada lingkungan uji; snapshot target/pemulihan tersedia sebelum deployment produksi |

Pada tahap 2–4: mulai lokal/mock, kemudian verifikasi integrasi Google pada lingkungan uji yang tersedia. Mutasi produksi tetap nonaktif sampai kontrak dan uji integrasi cukup. Dokumen lama tanpa field per item jangan otomatis dianggap sudah disetujui; pembacaan tetap aman dan konversi eksplisit bila diperlukan.

## Pembagian agen

Mode normal (saat burst tidak aktif): Codex memegang kontrak/integrasi; paling banyak satu tugas eksternal aktif yang hasilnya diperlukan. Analisis independen boleh diberikan ke Google AI Studio lewat pengguna. Tidak ada burst atau pengiriman ke agen eksternal otomatis.

Saat burst aktif, sesudah kontrak minimum stabil:

| Penulis | Batas kerja | Ketergantungan |
|---|---|---|
| A | UtpDomain.gs + tes domain khusus tahap | Kontrak disepakati |
| B | Utp.gs + tes penyimpanan khusus tahap | Kontrak disepakati; jangan mengedit domain A |
| C | UtpClient.html + tes frontend khusus tahap | Kontrak disepakati; gunakan stub kontrak sampai adapter siap |

Alat build, preview hasil build dan checkpoint dimiliki integrator. Codex boleh menjadi A/B/C; jangan menjadi penulis keempat. Pemilik satu file hanya satu pada satu waktu. Jika perubahan saling tergantung rapat, kerjakan berurutan; jangan memaksa paralel.

Platform tidak dipilih berdasarkan nama saja. Qwen dihentikan pada tugas approval karena tidak mengirim artefak. Tugas berikut dapat memakai AI lain yang tersedia atau Codex sendiri. Google AI Studio untuk analisis/skenario, bukan bukti eksekusi. Sebut platform tepat pada setiap prompt.

## Paket tugas hemat konteks

Setiap prompt siap copas memuat: platform; hasil yang diminta; baseline/file terkini; file boleh edit; aturan bisnis yang relevan; kriteria lulus; format keluaran.

Keluaran penulis wajib patch lengkap/file lengkap dan perintah + hasil tes. Keluaran reviewer wajib lokasi, pemicu, dampak, saran; bukan esai. Jangan kirim seluruh riwayat, peta repository, atau master privat jika tidak diperlukan.

Satu putaran tanpa patch: minta artefak dan error aktual. Putaran kedua tetap tanpa artefak atau diagnosis tidak didukung: ganti agen atau Codex ambil alih. Jangan menunggu semua hijau untuk menerima patch yang perlu didiagnosis.

## Perubahan kebutuhan

Catat perubahan singkat: apa berubah, tahap/file terdampak, kriteria lulus baru. Bekukan hanya kontrak tahap aktif; bagian lain boleh berkembang. Fitur mendatang masuk antrean, bukan dibangun sebagai fondasi spekulatif.

Prioritas setelah Material: pilih satu modul bernilai tertinggi bagi admin (misalnya tugas/Telegram atau nota), bukan semuanya bersamaan. Tunda keputusan rinci sampai kebutuhan aktif.

## Tes dan backup

Jalankan tes yang membuktikan perubahan; seluruh suite pada integrasi tahap atau sebelum rilis. Klaim selesai berdasarkan alur dan bukti, bukan persentase perkiraan. Bukti saat peta dibuat: 65 tes kode lokal dan 19 pemeriksaan browser lulus; Google runtime belum diverifikasi.

Commit/push setelah satu hasil stabil dan saat break. Deploy hanya ketika perubahan memang perlu tersedia di server, target diketahui, integrasi diuji dan pemulihan tersedia; izin pengguna sudah ada, tidak perlu konfirmasi rutin ulang. Hambatan akses atau data yang belum tersedia tetap dilaporkan.

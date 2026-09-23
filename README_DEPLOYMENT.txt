AMI UMA 2026 — V27 FULL PRODUCTION PACKAGE
Tanggal: 10 September 2026
Versi backend: 1.6.1-production-ready-v27
Build UI: AMI-UI-PRODUCTION-HARDENED-10SEP2026-V27

TUJUAN
Paket konsolidasi penuh untuk deployment produksi Audit Mutu Internal Universitas Medan Area.
Paket sudah menggabungkan hardening concurrency/login V26, UI profesional, deduplikasi auditor,
perbaikan report, hardening upload/Drive/import/report, validasi sistem, dan Reset Semua Data Uji.

FILE APPS SCRIPT YANG HARUS ADA — 16 FILE
1. Config.gs
2. Database.gs
3. Auth.gs
4. AdminService.gs
5. StandardService.gs
6. StandardSeed.gs
7. WorkflowService.gs
8. WorkflowBatchService.gs
9. ImportExportService.gs
10. ReportService.gs
11. QualityService.gs
12. MaintenanceService.gs
13. Code.gs
14. UiAssets.gs
15. Index.html
16. appsscript.json

PENTING — JANGAN CAMPUR DENGAN PATCH LAMA
Google Apps Script memakai satu global namespace. Setelah backup project, pastikan tidak ada file service lama/duplikat
seperti WorkflowBatchService_Vxx, SessionPersistence_Vxx, ImportExportService_Vxx, EnhancedReportService,
ReportSupportService, AmiReportService lama, Auth lama, Code lama, atau Index lama yang memiliki fungsi bernama sama.
Tidak perlu menghapus Google Spreadsheet atau sheet data.

LANGKAH UPGRADE/DEPLOY
1. Backup project Apps Script dan Spreadsheet database AMI.
2. Ganti source project sehingga menggunakan 16 file pada paket ini.
3. Pastikan appsscript.json ikut diganti.
4. Save All.
5. JANGAN menjalankan setupDatabase(). Database lama tetap dipakai.
6. Deploy > Manage deployments > Edit > New version > Deploy.
7. Buka Web App dan lakukan hard refresh (Ctrl+F5).
8. Pastikan build halaman: AMI-UI-PRODUCTION-HARDENED-10SEP2026-V27.
9. Login sebagai ADMIN_BPM.
10. Buka Pusat Validasi > Selaraskan Skema Final. Jalankan sekali.
11. Klik Jalankan Uji Mendalam. Pastikan pemeriksaan utama hijau/OK.
12. Uji login 1 Auditi, 1 Auditor/Lead, dan 1 Pimpinan.
13. Uji satu audit dari Evaluasi Diri sampai laporan sebelum kegiatan resmi.

RESET SEMUA DATA UJI
Menu: Admin BPM > Pusat Validasi > Reset Semua Data Uji.
Sistem lebih dahulu menampilkan preview data yang akan dibersihkan.
Konfirmasi wajib: RESET SEMUA DATA UJI AMI 2026

Yang DIHAPUS:
- AMI_AUDITI
- AMI_STANDARD_ASSIGN
- AMI_TEAM
- SELF_EVAL
- SELF_FOLLOW_UP
- EVIDENCE
- DESK_EVAL
- VISIT
- FORM2_PROGRAM_KERJA
- FORM3_CATATAN
- FINDINGS
- AMI_IMPROVEMENT
- APPROVAL
- REPORT_LOG
- AUDIT_LOG
- SYSTEM_ERROR_LOG
- file bukti dan file laporan yang tercatat pada transaksi uji akan dipindahkan ke Trash Drive bila dapat diakses.

Yang DIPERTAHANKAN:
- SETTINGS dan SOURCE_REGISTER
- MASTER_STANDAR
- MASTER_PRODI dan MASTER_UNIT
- MASTER_AUDITOR
- MASTER_PIMPINAN
- USERS dan credential/password
- SESSIONS
- AMI_CYCLE
- struktur/header seluruh sheet
- konfigurasi/folder utama aplikasi

Reset tidak dijalankan otomatis. Jalankan hanya bila seluruh transaksi saat ini memang data uji.
Setelah reset, audit resmi dapat dibuat kembali dari menu Penetapan Audit dengan master yang tetap utuh.

CATATAN PERFORMANCE
- Login memakai fast session store dan tidak menunggu global database lock pada jalur kritis.
- Bootstrap/login memiliki retry terkontrol untuk error sementara.
- Operasi tulis tidak di-retry otomatis agar tidak terjadi double-save.
- Upload bukti dan operasi Drive berat dilakukan sejauh mungkin di luar global lock.
- Workspace menggunakan snapshot standar dan hanya membaca seluruh MASTER_STANDAR bila diperlukan.
- Dashboard publik memakai cache singkat agar pembukaan serentak tidak membebani server berulang.

DEPLOY NODE.JS KE RENDER + SUPABASE
1. Buat project PostgreSQL Free di Supabase.
2. Salin connection string PostgreSQL dari Supabase. Gunakan connection pooling URL bila tersedia.
3. Buka Render dan pilih New > Blueprint.
4. Hubungkan repository GitHub `khhfizuhanda/Aplikasi-AMI` pada branch `main`.
5. Saat diminta, isi `DATABASE_URL` dengan connection string Supabase.
6. Pastikan `PGSSL=true`; Render akan membaca `render.yaml`.
7. Tunggu build dan deploy selesai. Schema PostgreSQL dijalankan otomatis sebelum server dimulai.
8. Aktifkan GitHub Pages dari Settings > Pages > Deploy from a branch, pilih `main` dan folder `/docs`.
9. Buka frontend di `https://khhfizuhanda.github.io/Aplikasi-AMI/`.

Backend Render tersedia di `https://aplikasi-ami.onrender.com`; health check tersedia di `/api/health`.

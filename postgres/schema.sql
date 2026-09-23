-- AMI 2026 PostgreSQL schema generated from Config.gs SHEET_DEFS.
-- Values are intentionally TEXT during the first migration to preserve Sheets data exactly.
CREATE SCHEMA IF NOT EXISTS ami;
SET search_path TO ami;

CREATE TABLE IF NOT EXISTS "SETTINGS" ("Key" TEXT, "Value" TEXT, "Description" TEXT, "UpdatedAt" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "SOURCE_REGISTER" ("SourceID" TEXT, "Kelompok" TEXT, "NamaFile" TEXT, "Tahun" TEXT, "JumlahButir" TEXT, "CatatanVerifikasi" TEXT);
CREATE TABLE IF NOT EXISTS "MASTER_STANDAR" ("StandardID" TEXT, "ItemCode" TEXT, "Kelompok" TEXT, "KodeKelompokStandar" TEXT, "NamaStandar" TEXT, "NoSumber" TEXT, "PernyataanStandar" TEXT, "StrategiPencapaian" TEXT, "Indikator" TEXT, "SumberFile" TEXT, "TahunSumber" TEXT, "HalamanPDFMulai" TEXT, "HalamanPDFAkhir" TEXT, "SourceHash" TEXT, "Active" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT, "StandardFamilyID" TEXT, "Versi" TEXT, "TahunBerlakuMulai" TEXT, "TahunBerlakuSampai" TEXT, "StatusStandar" TEXT, "ReplacesStandardID" TEXT, "Origin" TEXT, "Locked" TEXT, "Notes" TEXT, "CreatedBy" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "MASTER_PRODI" ("ProdiID" TEXT, "KodeProdi" TEXT, "NamaProdi" TEXT, "Fakultas" TEXT, "Jenjang" TEXT, "Kaprodi" TEXT, "NIDN" TEXT, "Active" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "MASTER_UNIT" ("UnitID" TEXT, "KodeUnit" TEXT, "NamaUnit" TEXT, "JenisUnit" TEXT, "Pimpinan" TEXT, "Active" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "MASTER_AUDITOR" ("AuditorID" TEXT, "NIDN_NIK" TEXT, "Nama" TEXT, "Unit" TEXT, "Sertifikasi" TEXT, "Active" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "MASTER_PIMPINAN" ("PimpinanID" TEXT, "Nama" TEXT, "Jabatan" TEXT, "Level" TEXT, "Active" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT, "UnitID" TEXT, "AccessType" TEXT, "AccessID" TEXT, "AccessName" TEXT);
CREATE TABLE IF NOT EXISTS "USERS" ("UserID" TEXT, "Username" TEXT, "PasswordHash" TEXT, "Salt" TEXT, "Nama" TEXT, "Role" TEXT, "RefType" TEXT, "RefID" TEXT, "Active" TEXT, "ForceChangePassword" TEXT, "LastLogin" TEXT, "CreatedAt" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "SESSIONS" ("Token" TEXT, "UserID" TEXT, "ExpiresAt" TEXT, "CreatedAt" TEXT, "LastSeenAt" TEXT, "ResumeKey" TEXT);
CREATE TABLE IF NOT EXISTS "AMI_CYCLE" ("CycleID" TEXT, "NamaSiklus" TEXT, "Tahun" TEXT, "TahunAkademik" TEXT, "TanggalMulai" TEXT, "BatasEvaluasiDiri" TEXT, "DeskStart" TEXT, "DeskEnd" TEXT, "VisitStart" TEXT, "VisitEnd" TEXT, "Status" TEXT, "Active" TEXT, "CreatedAt" TEXT, "CreatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "AMI_AUDITI" ("AuditID" TEXT, "CycleID" TEXT, "AuditiType" TEXT, "AuditiID" TEXT, "AuditiName" TEXT, "Fakultas" TEXT, "Jenjang" TEXT, "Status" TEXT, "PublishedAt" TEXT, "CreatedAt" TEXT, "CreatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "AMI_STANDARD_ASSIGN" ("AssignID" TEXT, "AuditID" TEXT, "StandardID" TEXT, "ItemCode" TEXT, "NamaStandar" TEXT, "AssignedAt" TEXT, "AssignedBy" TEXT, "Active" TEXT, "KelompokSnapshot" TEXT, "KodeKelompokSnapshot" TEXT, "PernyataanStandarSnapshot" TEXT, "StrategiSnapshot" TEXT, "IndikatorSnapshot" TEXT, "SumberFileSnapshot" TEXT, "TahunSumberSnapshot" TEXT, "SourceHashSnapshot" TEXT, "VersiStandarSnapshot" TEXT, "TahunBerlakuSnapshot" TEXT);
CREATE TABLE IF NOT EXISTS "AMI_TEAM" ("TeamID" TEXT, "AuditID" TEXT, "LeadAuditorID" TEXT, "Member1ID" TEXT, "Member2ID" TEXT, "AssignedAt" TEXT, "AssignedBy" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "SELF_EVAL" ("SelfEvalID" TEXT, "AuditID" TEXT, "AssignID" TEXT, "StandardID" TEXT, "Capaian" TEXT, "NilaiCapaian" TEXT, "EvaluasiDiri" TEXT, "Akibat" TEXT, "AkarPenyebab" TEXT, "Status" TEXT, "BuktiCount" TEXT, "SavedAt" TEXT, "SubmittedAt" TEXT, "SubmittedBy" TEXT);
CREATE TABLE IF NOT EXISTS "SELF_FOLLOW_UP" ("FollowUpID" TEXT, "AuditID" TEXT, "AssignID" TEXT, "StandardID" TEXT, "SelfEvalID" TEXT, "CapaianAwal" TEXT, "TanggapanAuditi" TEXT, "RencanaPerbaikan" TEXT, "JadwalPerbaikan" TEXT, "PJPerbaikan" TEXT, "RencanaPencegahan" TEXT, "JadwalPencegahan" TEXT, "PJPencegahan" TEXT, "Status" TEXT, "SavedAt" TEXT, "SavedBy" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "EVIDENCE" ("EvidenceID" TEXT, "SelfEvalID" TEXT, "AuditID" TEXT, "StandardID" TEXT, "NamaBukti" TEXT, "JenisBukti" TEXT, "URL" TEXT, "DriveFileID" TEXT, "Keterangan" TEXT, "ClientKey" TEXT, "FileSize" TEXT, "UploadedAt" TEXT, "UploadedBy" TEXT);
CREATE TABLE IF NOT EXISTS "DESK_EVAL" ("DeskID" TEXT, "AuditID" TEXT, "AssignID" TEXT, "StandardID" TEXT, "StatusDesk" TEXT, "CatatanDesk" TEXT, "ButuhVisitasi" TEXT, "AuditorID" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "VISIT" ("VisitID" TEXT, "AuditID" TEXT, "Tanggal" TEXT, "JamMulai" TEXT, "JamSelesai" TEXT, "Lokasi" TEXT, "WakilAuditi" TEXT, "CatatanUmum" TEXT, "Status" TEXT, "UpdatedAt" TEXT);
CREATE TABLE IF NOT EXISTS "FORM2_PROGRAM_KERJA" ("Form2ID" TEXT, "AuditID" TEXT, "TentatifAuditObjektif" TEXT, "TujuanAudit" TEXT, "LangkahJSON" TEXT, "UpdatedAt" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "FORM3_CATATAN" ("Form3ID" TEXT, "AuditID" TEXT, "CatatanJSON" TEXT, "UpdatedAt" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "FINDINGS" ("FindingID" TEXT, "AuditID" TEXT, "AssignID" TEXT, "StandardID" TEXT, "Kategori" TEXT, "Deskripsi" TEXT, "Kriteria" TEXT, "Akibat" TEXT, "AkarPenyebab" TEXT, "Rekomendasi" TEXT, "TanggapanAuditi" TEXT, "RencanaPerbaikan" TEXT, "JadwalPerbaikan" TEXT, "PJPerbaikan" TEXT, "RencanaPencegahan" TEXT, "JadwalPencegahan" TEXT, "PJPencegahan" TEXT, "CreatedAt" TEXT, "CreatedBy" TEXT, "UpdatedAt" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "AMI_IMPROVEMENT" ("ImprovementID" TEXT, "AuditID" TEXT, "AssignID" TEXT, "StandardID" TEXT, "SelfEvalID" TEXT, "CapaianAwal" TEXT, "KategoriFinal" TEXT, "FaktorPendukung" TEXT, "RekomendasiPeningkatanIndikator" TEXT, "Status" TEXT, "SavedAt" TEXT, "SavedBy" TEXT, "UpdatedAt" TEXT, "UpdatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "APPROVAL" ("ApprovalID" TEXT, "AuditID" TEXT, "Stage" TEXT, "Approved" TEXT, "ApprovedByUserID" TEXT, "ApprovedByNama" TEXT, "ApprovedByRole" TEXT, "ApprovedAt" TEXT, "VersionHash" TEXT, "Note" TEXT);
CREATE TABLE IF NOT EXISTS "REPORT_LOG" ("ReportID" TEXT, "AuditID" TEXT, "Version" TEXT, "Status" TEXT, "GoogleDocID" TEXT, "DocxFileID" TEXT, "PdfFileID" TEXT, "ValidationHash" TEXT, "DocxBytes" TEXT, "PdfBytes" TEXT, "CreatedAt" TEXT, "CreatedBy" TEXT);
CREATE TABLE IF NOT EXISTS "AUDIT_LOG" ("LogID" TEXT, "Timestamp" TEXT, "UserID" TEXT, "Nama" TEXT, "Role" TEXT, "Action" TEXT, "Module" TEXT, "AuditID" TEXT, "RecordID" TEXT, "BeforeJSON" TEXT, "AfterJSON" TEXT);
CREATE TABLE IF NOT EXISTS "SYSTEM_ERROR_LOG" ("ErrorID" TEXT, "Timestamp" TEXT, "UserID" TEXT, "Username" TEXT, "Role" TEXT, "FunctionName" TEXT, "Message" TEXT, "Stack" TEXT, "ContextJSON" TEXT);

CREATE INDEX IF NOT EXISTS "idx_users_username" ON "USERS" ("Username");
CREATE INDEX IF NOT EXISTS "idx_sessions_user" ON "SESSIONS" ("UserID");
CREATE INDEX IF NOT EXISTS "idx_auditi_cycle" ON "AMI_AUDITI" ("CycleID");
CREATE INDEX IF NOT EXISTS "idx_assign_audit" ON "AMI_STANDARD_ASSIGN" ("AuditID");
CREATE INDEX IF NOT EXISTS "idx_self_eval_audit" ON "SELF_EVAL" ("AuditID");
CREATE INDEX IF NOT EXISTS "idx_findings_audit" ON "FINDINGS" ("AuditID");
CREATE INDEX IF NOT EXISTS "idx_audit_log_audit" ON "AUDIT_LOG" ("AuditID");

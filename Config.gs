/**
 * Config.gs — AMI UMA 2026 FINAL OPTIMIZED
 * Satu konfigurasi aktif untuk seluruh project.
 */
const AMI_CONFIG = Object.freeze({
  VERSION: '1.6.2-user-password-bulk-v28',
  APP_NAME: 'Sistem Audit Mutu Internal (AMI) 2026',
  ORG_NAME: 'Universitas Medan Area',
  UNIT_NAME: 'Biro Penjaminan Mutu',
  TIMEZONE: 'Asia/Jakarta',
  SESSION_HOURS: 12,
  SESSION_SLIDING_MINUTES: 20,
  MAX_UPLOAD_BYTES: 8 * 1024 * 1024,
  PUBLIC_DASHBOARD_ENABLED: true,
  PUBLIC_SHOW_AUDITI_NAMES: true,
  PUBLIC_DASHBOARD_CACHE_SECONDS: 90,
  REQUIRE_EVIDENCE_PER_ITEM: true,
  EXPECTED_STANDARD_SEED_COUNT: 130,
  DB_SPREADSHEET_ID: '1wyEhGjB3LJxUrJN4LxovfBBkypzMRMNLXxRUgK4A-KI',
  DEFAULT_ADMIN_USERNAME: 'admin',
  DEFAULT_ADMIN_PASSWORD: 'admin123',
  DEFAULT_USER_PASSWORD: 'ami2026!',
  ROLES: ['ADMIN_BPM', 'AUDITOR', 'AUDITI', 'PIMPINAN'],
  PIMPINAN_LEVELS: ['YAYASAN', 'UNIVERSITAS', 'FAKULTAS', 'PRODI', 'UNIT'],
  UNIT_TYPES: ['BIRO', 'LEMBAGA', 'UPT', 'PUSAT', 'DIREKTORAT', 'FAKULTAS', 'PASCASARJANA', 'UNIT LAINNYA'],
  AUDITOR_CERTIFICATION: ['IYA', 'TIDAK'],
  STANDARD_STATUSES: ['DRAFT', 'BERLAKU', 'DICABUT', 'ARSIP'],
  CAPAIAN: ['MENYIMPANG', 'BELUM MENCAPAI', 'MENCAPAI', 'MELAMPAUI'],
  DESK_STATUSES: ['SESUAI', 'PERLU KLARIFIKASI', 'BUKTI BELUM CUKUP', 'PERLU VERIFIKASI LAPANGAN', 'INDIKASI TEMUAN'],
  AUDIT_STATUSES: [
    'DRAFT BPM', 'PENUGASAN DITERBITKAN', 'EVALUASI DIRI BERJALAN',
    'EVALUASI DIRI DIKIRIM', 'PERLU REVISI AUDITI', 'DESK EVALUATION',
    'SIAP VISITASI', 'VISITASI BERJALAN', 'HASIL AUDIT DIISI',
    'MENUNGGU ACC AUDITI', 'MENUNGGU ACC LEAD', 'MENUNGGU ACC BPM',
    'PERLU REVISI AUDITOR', 'FINAL'
  ]
});

const SHEET_DEFS = Object.freeze({
  SETTINGS: ['Key','Value','Description','UpdatedAt','UpdatedBy'],
  SOURCE_REGISTER: ['SourceID','Kelompok','NamaFile','Tahun','JumlahButir','CatatanVerifikasi'],
  MASTER_STANDAR: ['StandardID','ItemCode','Kelompok','KodeKelompokStandar','NamaStandar','NoSumber','PernyataanStandar','StrategiPencapaian','Indikator','SumberFile','TahunSumber','HalamanPDFMulai','HalamanPDFAkhir','SourceHash','Active','CreatedAt','UpdatedAt','StandardFamilyID','Versi','TahunBerlakuMulai','TahunBerlakuSampai','StatusStandar','ReplacesStandardID','Origin','Locked','Notes','CreatedBy','UpdatedBy'],
  MASTER_PRODI: ['ProdiID','KodeProdi','NamaProdi','Fakultas','Jenjang','Kaprodi','NIDN','Active','CreatedAt','UpdatedAt'],
  MASTER_UNIT: ['UnitID','KodeUnit','NamaUnit','JenisUnit','Pimpinan','Active','CreatedAt','UpdatedAt'],
  MASTER_AUDITOR: ['AuditorID','NIDN_NIK','Nama','Unit','Sertifikasi','Active','CreatedAt','UpdatedAt'],
  MASTER_PIMPINAN: ['PimpinanID','Nama','Jabatan','Level','Active','CreatedAt','UpdatedAt','UnitID','AccessType','AccessID','AccessName'],
  USERS: ['UserID','Username','PasswordHash','Salt','Nama','Role','RefType','RefID','Active','ForceChangePassword','LastLogin','CreatedAt','UpdatedAt'],
  SESSIONS: ['Token','UserID','ExpiresAt','CreatedAt','LastSeenAt','ResumeKey'],
  AMI_CYCLE: ['CycleID','NamaSiklus','Tahun','TahunAkademik','TanggalMulai','BatasEvaluasiDiri','DeskStart','DeskEnd','VisitStart','VisitEnd','Status','Active','CreatedAt','CreatedBy'],
  AMI_AUDITI: ['AuditID','CycleID','AuditiType','AuditiID','AuditiName','Fakultas','Jenjang','Status','PublishedAt','CreatedAt','CreatedBy'],
  AMI_STANDARD_ASSIGN: ['AssignID','AuditID','StandardID','ItemCode','NamaStandar','AssignedAt','AssignedBy','Active','KelompokSnapshot','KodeKelompokSnapshot','PernyataanStandarSnapshot','StrategiSnapshot','IndikatorSnapshot','SumberFileSnapshot','TahunSumberSnapshot','SourceHashSnapshot','VersiStandarSnapshot','TahunBerlakuSnapshot'],
  AMI_TEAM: ['TeamID','AuditID','LeadAuditorID','Member1ID','Member2ID','AssignedAt','AssignedBy','UpdatedAt'],
  SELF_EVAL: ['SelfEvalID','AuditID','AssignID','StandardID','Capaian','NilaiCapaian','EvaluasiDiri','Akibat','AkarPenyebab','Status','BuktiCount','SavedAt','SubmittedAt','SubmittedBy'],
  SELF_FOLLOW_UP: ['FollowUpID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','Status','SavedAt','SavedBy','UpdatedAt'],
  EVIDENCE: ['EvidenceID','SelfEvalID','AuditID','StandardID','NamaBukti','JenisBukti','URL','DriveFileID','Keterangan','ClientKey','FileSize','UploadedAt','UploadedBy'],
  DESK_EVAL: ['DeskID','AuditID','AssignID','StandardID','StatusDesk','CatatanDesk','ButuhVisitasi','AuditorID','UpdatedAt'],
  VISIT: ['VisitID','AuditID','Tanggal','JamMulai','JamSelesai','Lokasi','WakilAuditi','CatatanUmum','Status','UpdatedAt'],
  FORM2_PROGRAM_KERJA: ['Form2ID','AuditID','TentatifAuditObjektif','TujuanAudit','LangkahJSON','UpdatedAt','UpdatedBy'],
  FORM3_CATATAN: ['Form3ID','AuditID','CatatanJSON','UpdatedAt','UpdatedBy'],
  FINDINGS: ['FindingID','AuditID','AssignID','StandardID','Kategori','Deskripsi','Kriteria','Akibat','AkarPenyebab','Rekomendasi','TanggapanAuditi','RencanaPerbaikan','JadwalPerbaikan','PJPerbaikan','RencanaPencegahan','JadwalPencegahan','PJPencegahan','CreatedAt','CreatedBy','UpdatedAt','UpdatedBy'],
  AMI_IMPROVEMENT: ['ImprovementID','AuditID','AssignID','StandardID','SelfEvalID','CapaianAwal','KategoriFinal','FaktorPendukung','RekomendasiPeningkatanIndikator','Status','SavedAt','SavedBy','UpdatedAt','UpdatedBy'],
  APPROVAL: ['ApprovalID','AuditID','Stage','Approved','ApprovedByUserID','ApprovedByNama','ApprovedByRole','ApprovedAt','VersionHash','Note'],
  REPORT_LOG: ['ReportID','AuditID','Version','Status','GoogleDocID','DocxFileID','PdfFileID','ValidationHash','DocxBytes','PdfBytes','CreatedAt','CreatedBy'],
  AUDIT_LOG: ['LogID','Timestamp','UserID','Nama','Role','Action','Module','AuditID','RecordID','BeforeJSON','AfterJSON'],
  SYSTEM_ERROR_LOG: ['ErrorID','Timestamp','UserID','Username','Role','FunctionName','Message','Stack','ContextJSON']
});

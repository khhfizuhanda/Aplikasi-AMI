import {Buffer} from 'node:buffer';
import {createHash, randomUUID} from 'node:crypto';
import {PDFDocument, StandardFonts, rgb} from 'npm:pdf-lib@1.17.1';
import {Document, Packer, Paragraph, TextRun, HeadingLevel} from 'npm:docx@9.5.1';
import {pool, transaction} from './database.mjs';
import {getAuditWorkspace} from './generated/read.mjs';
import {getAuditValidation} from './generated/workflow.mjs';

const clean = value => String(value ?? '').trim();
const safeName = value => clean(value).replace(/[^a-z0-9._-]+/gi, '_').slice(0,120) || 'dokumen';
const fileResponse = row => ({ok:true,filename:row.FileName,fileName:row.FileName,mime:row.MimeType,mimeType:row.MimeType,base64:Buffer.from(row.Bytes).toString('base64')});
async function saveFile(db,auditId,fileName,mime,bytes) {
  const id = `FILE-${randomUUID()}`;
  await db.query('INSERT INTO ami."FILE_STORE" ("FileID","AuditID","FileName","MimeType","Bytes") VALUES ($1,$2,$3,$4,$5)',[id,auditId,fileName,mime,Buffer.from(bytes)]);
  return id;
}
export async function uploadEvidence(user,auditId,assignId,payload) {
  if(user.Role !== 'AUDITI') throw Object.assign(new Error('Hanya Auditi yang dapat mengunggah bukti.'),{status:403});
  const bytes = Buffer.from(clean(payload?.base64).replace(/^data:[^,]+,/,''),'base64');
  if(!bytes.length || bytes.length > 15*1024*1024) throw new Error('Ukuran bukti harus antara 1 byte dan 15 MB.');
  return transaction(async db => {
    const workspace = await getAuditWorkspace(db,'ami',user,auditId);
    if(!['PENUGASAN DITERBITKAN','EVALUASI DIRI BERJALAN','PERLU REVISI AUDITI'].includes(workspace.audit.Status)) throw new Error('Bukti terkunci pada status audit ini.');
    const assignment = workspace.assigned.find(row => clean(row.AssignID) === clean(assignId));
    if(!assignment) throw new Error('Standar tidak ditugaskan pada audit ini.');
    const existing = workspace.evidence.find(row => payload.ClientKey && row.ClientKey === payload.ClientKey && row.StandardID === assignment.StandardID);
    if(existing) return {ok:true,evidenceId:existing.EvidenceID,reused:true};
    let self = workspace.selfEval.find(row => row.AssignID === assignId);
    if(!self) {
      self = {SelfEvalID:`SELF-${randomUUID()}`};
      await db.query('INSERT INTO ami."SELF_EVAL" ("SelfEvalID","AuditID","AssignID","StandardID","Status","BuktiCount","SavedAt") VALUES ($1,$2,$3,$4,\'DRAFT\',\'0\',$5)',[self.SelfEvalID,auditId,assignId,assignment.StandardID,new Date().toISOString()]);
    }
    const fileId = await saveFile(db,auditId,safeName(payload.name),clean(payload.mimeType)||'application/octet-stream',bytes);
    const evidenceId = `EVD-${randomUUID()}`;
    await db.query('INSERT INTO ami."EVIDENCE" ("EvidenceID","SelfEvalID","AuditID","StandardID","NamaBukti","JenisBukti","URL","DriveFileID","Keterangan","ClientKey","FileSize","UploadedAt","UploadedBy") VALUES ($1,$2,$3,$4,$5,\'FILE\',\'\',$6,$7,$8,$9,$10,$11)',[evidenceId,self.SelfEvalID,auditId,assignment.StandardID,clean(payload.name),fileId,clean(payload.Keterangan),clean(payload.ClientKey),String(bytes.length),new Date().toISOString(),user.Nama]);
    await db.query('UPDATE ami."SELF_EVAL" SET "BuktiCount"=(SELECT count(*)::text FROM ami."EVIDENCE" WHERE "SelfEvalID"=$1) WHERE "SelfEvalID"=$1',[self.SelfEvalID]);
    return {ok:true,evidenceId};
  });
}
export async function downloadEvidenceFile(user,id) {
  const row=(await pool.query('SELECT * FROM ami."EVIDENCE" WHERE "EvidenceID"=$1',[id])).rows[0];
  if(!row) throw new Error('Bukti tidak ditemukan.');
  await getAuditWorkspace(pool,'ami',user,row.AuditID);
  const file=(await pool.query('SELECT * FROM ami."FILE_STORE" WHERE "FileID"=$1 AND "AuditID"=$2',[row.DriveFileID,row.AuditID])).rows[0];
  if(!file) throw new Error('File bukti tidak tersimpan pada server ini. Untuk bukti tautan, buka URL bukti.');
  return fileResponse(file);
}
function reportLines(w) {
  const lines=[];
  const add=(text,heading=false)=>lines.push({text:clean(text),heading});
  const fields=(record, mapping)=>mapping.forEach(([key,label])=>{if(clean(record?.[key]))add(`${label}: ${record[key]}`);});
  add('LAPORAN AUDIT MUTU INTERNAL',true);
  add(w.audit.Status === 'FINAL' ? 'FINAL' : 'DRAF / PRATINJAU',true);
  fields(w.audit,[['AuditiName','Auditi'],['AuditiType','Jenis'],['Fakultas','Fakultas'],['Jenjang','Jenjang'],['AuditID','ID Audit'],['Status','Status']]);
  fields(w.cycle,[['NamaSiklus','Siklus'],['TahunAkademik','Tahun Akademik']]);
  add('Tim Auditor',true);
  for(const [key,label] of [['Lead','Lead Auditor'],['Member1','Anggota 1'],['Member2','Anggota 2']]) add(`${label}: ${w.team[key]?.nama || '-'}`);
  add('Pelaksanaan Visitasi',true);
  fields(w.visit,[['Tanggal','Tanggal'],['JamMulai','Jam mulai'],['JamSelesai','Jam selesai'],['Lokasi','Lokasi'],['WakilAuditi','Wakil auditi'],['CatatanUmum','Catatan umum']]);
  add('Program Kerja Audit',true);
  let programs=[];try{programs=JSON.parse(w.form2.LangkahJSON||'[]');}catch{}
  for(const p of programs){add(`${p.nomorStandar||''} ${p.namaStandar||''}`,true);fields(p,[['tentatifAuditObjektif','Objektif'],['tujuanAudit','Tujuan']]);for(const step of p.langkahKerja||[])fields(step,[['uraian','Langkah'],['estimasi','Estimasi'],['realisasi','Realisasi'],['inisialAuditor','Auditor']]);}
  add('Catatan Audit',true);
  let notes=[];try{notes=JSON.parse(w.form3.CatatanJSON||'[]');}catch{}
  for(const note of notes){fields(note,[['catatan','Catatan'],['tanggal','Tanggal']]);for(const ref of note.dokumenReferensi||[]) fields(ref,[['dokumenRef','Referensi']]);}
  for(const a of w.assigned){
    add(`${a.ItemCode || ''} - ${a.standard.NamaStandar || ''}`,true);
    fields(a.standard,[['Versi','Versi standar'],['PernyataanStandar','Pernyataan standar'],['Indikator','Indikator'],['StrategiPencapaian','Strategi'],['SumberFile','Sumber']]);
    const self=w.selfEval.find(row=>row.AssignID===a.AssignID)||{};
    fields(self,[['Capaian','Capaian auditi'],['NilaiCapaian','Nilai aktual'],['EvaluasiDiri','Evaluasi diri'],['Akibat','Akibat'],['AkarPenyebab','Akar penyebab']]);
    for(const e of w.evidence.filter(row=>row.StandardID===a.StandardID)) add(`Bukti: ${e.NamaBukti || '-'}${e.URL ? ' - '+e.URL : ''}`);
    fields(w.desk.find(row=>row.AssignID===a.AssignID),[['StatusDesk','Status desk'],['CatatanDesk','Catatan desk'],['ButuhVisitasi','Perlu visitasi']]);
    fields(w.findings.find(row=>row.AssignID===a.AssignID),[['Kategori','Hasil audit'],['Deskripsi','Deskripsi'],['Kriteria','Kriteria'],['Akibat','Akibat'],['AkarPenyebab','Akar penyebab'],['Rekomendasi','Rekomendasi auditor'],['TanggapanAuditi','Tanggapan auditi'],['RencanaPerbaikan','Rencana perbaikan'],['JadwalPerbaikan','Jadwal perbaikan'],['PJPerbaikan','Penanggung jawab perbaikan'],['RencanaPencegahan','Rencana pencegahan'],['JadwalPencegahan','Jadwal pencegahan'],['PJPencegahan','Penanggung jawab pencegahan']]);
    fields(w.improvements.find(row=>row.AssignID===a.AssignID),[['FaktorPendukung','Faktor pendukung'],['RekomendasiPeningkatanIndikator','Peningkatan indikator']]);
  }
  add('Persetujuan',true);
  for(const [stage,a] of Object.entries(w.approvals))add(`${stage}: ${a.ApprovedByNama} (${a.ApprovedByRole}) - ${a.ApprovedAtDisplay || a.ApprovedAt}${a.Note ? ' - '+a.Note : ''}`);
  return lines;
}
async function renderReport(workspace) {
  const lines=reportLines(workspace);
  const pdf=await PDFDocument.create();
  const regular=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  let page,y,pageNo=0;
  const newPage=()=>{page=pdf.addPage([595.28,841.89]);y=790;pageNo++;page.drawText(`AMI | ${pageNo}`,{x:48,y:24,size:9,font:regular,color:rgb(.4,.4,.4)});};newPage();
  const printable=value=>Array.from(value.replace(/[\t\r]/g,' ')).map(c=>{try{regular.encodeText(c);return c;}catch{return '?';}}).join('');
  for(const line of lines){const font=line.heading?bold:regular,size=line.heading?12:10; if(line.heading)y-=8;
    for(const paragraph of printable(line.text).split('\n')){
      let current='';for(const char of paragraph){if(current && font.widthOfTextAtSize(current+char,size)>499){if(y<55)newPage();page.drawText(current,{x:48,y,size,font});y-=15;current='';}current+=char;}
      if(y<55)newPage();if(current)page.drawText(current,{x:48,y,size,font});y-=16;
    }
  }
  const doc=new Document({sections:[{children:lines.map(line=>new Paragraph({heading:line.heading?HeadingLevel.HEADING_2:undefined,children:[new TextRun({text:line.text,size:22})],spacing:{after:100}}))}]});
  return {pdf:await pdf.save(),docx:await Packer.toBuffer(doc)};
}
export async function getAmiReportPreview(user,auditId) {
  const workspace=await getAuditWorkspace(pool,'ami',user,auditId);
  const report=await renderReport(workspace);
  return fileResponse({FileName:`Preview_AMI_${safeName(workspace.audit.AuditiName)}.pdf`,MimeType:'application/pdf',Bytes:report.pdf});
}
export async function generateAmiFinalReport(user,auditId) {
  if(user.Role!=='ADMIN_BPM')throw Object.assign(new Error('Hanya BPM yang dapat menerbitkan laporan final.'),{status:403});
  return transaction(async db=>{
    const workspace=await getAuditWorkspace(db,'ami',user,auditId);
    if(workspace.audit.Status!=='FINAL')throw new Error('Audit belum FINAL.');
    const validation=await getAuditValidation(db,'ami',user,auditId);
    if(!validation.ok)throw new Error(validation.errors.join(' | '));
    const hash=createHash('sha256').update(JSON.stringify({...workspace,reports:[],permissions:{}})).digest('hex');
    const old=workspace.reports.find(row=>row.ValidationHash===hash && row.Status==='FINAL');
    if(old && (await db.query('SELECT count(*)::int AS count FROM ami."FILE_STORE" WHERE "FileID"=ANY($1::text[])',[[old.DocxFileID,old.PdfFileID]])).rows[0].count===2)return {ok:true,reportId:old.ReportID,version:old.Version,reused:true};
    const files=await renderReport(workspace),version=Math.max(0,...workspace.reports.map(row=>Number(row.Version)||0))+1;
    const name=`AMI_${safeName(workspace.audit.AuditiName)}_v${version}`;
    const docx=await saveFile(db,auditId,name+'.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',files.docx);
    const pdf=await saveFile(db,auditId,name+'.pdf','application/pdf',files.pdf);
    await db.query('UPDATE ami."REPORT_LOG" SET "Status"=\'ARSIP\' WHERE "AuditID"=$1 AND "Status"=\'FINAL\'',[auditId]);
    const id=`RPT-${randomUUID()}`;
    await db.query('INSERT INTO ami."REPORT_LOG" ("ReportID","AuditID","Version","Status","GoogleDocID","DocxFileID","PdfFileID","ValidationHash","DocxBytes","PdfBytes","CreatedAt","CreatedBy") VALUES ($1,$2,$3,\'FINAL\',\'\',$4,$5,$6,$7,$8,$9,$10)',[id,auditId,String(version),docx,pdf,hash,String(files.docx.length),String(files.pdf.length),new Date().toISOString(),user.Nama]);
    return {ok:true,reportId:id,version,reused:false,message:'Laporan Word dan PDF berhasil dibuat.'};
  });
}
export async function listReports(user) {
  const allowed=(await import('./generated/read.mjs')).getAccessibleAudits;
  const audits=await allowed(pool,'ami',user);
  const ids=audits.map(row=>row.AuditID);
  const rows=(await pool.query('SELECT * FROM ami."REPORT_LOG" WHERE "AuditID"=ANY($1::text[]) ORDER BY "CreatedAt" DESC',[ids])).rows;
  return rows.map(row=>({...row,AuditiName:audits.find(a=>a.AuditID===row.AuditID)?.AuditiName,CreatedAtDisplay:row.CreatedAt}));
}
export async function downloadReportFile(user,id,format) {
  if(!['pdf','docx'].includes(clean(format).toLowerCase()))throw new Error('Format laporan tidak valid.');
  const report=(await pool.query('SELECT * FROM ami."REPORT_LOG" WHERE "ReportID"=$1',[id])).rows[0];
  if(!report)throw new Error('Laporan tidak ditemukan.');
  await getAuditWorkspace(pool,'ami',user,report.AuditID);
  const file=(await pool.query('SELECT * FROM ami."FILE_STORE" WHERE "FileID"=$1 AND "AuditID"=$2',[clean(format).toLowerCase()==='pdf'?report.PdfFileID:report.DocxFileID,report.AuditID])).rows[0];
  if(!file)throw new Error('File belum tersedia di server ini. BPM perlu membuat ulang laporan.');
  return fileResponse(file);
}

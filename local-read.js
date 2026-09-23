const clean = value => String(value == null ? '' : value).trim();
const truthy = value => value === true || ['true', '1', 'yes'].includes(clean(value).toLowerCase());
const quote = value => '"' + String(value).replace(/"/g, '""') + '"';
const table = (schema, name) => `${quote(schema)}.${quote(name)}`;
const rows = async (pool, schema, name) => (await pool.query(`SELECT * FROM ${table(schema, name)}`)).rows;
const byId = (values, key) => Object.fromEntries(values.map(value => [clean(value[key]), value]));
const same = (left, right) => clean(left) === clean(right);

function requireAdmin(user) {
  if (!user || user.Role !== 'ADMIN_BPM') {
    const error = new Error('Hanya Admin BPM yang dapat mengakses data ini.');
    error.status = 403;
    throw error;
  }
}

function pimpinanScope(user, pimpinanRows) {
  if (!user || user.Role !== 'PIMPINAN') return null;
  const profile = pimpinanRows.find(row => truthy(row.Active) && same(row.PimpinanID, user.RefID));
  if (!profile) return null;
  const level = clean(profile.Level).toUpperCase().replace(/\s+/g, '_').replace(/\//g, '_');
  const accessType = clean(profile.AccessType) || level;
  return {level, accessType, accessId: clean(profile.AccessID) || (level === 'UNIT' ? clean(profile.UnitID) : ''), accessName: clean(profile.AccessName)};
}

function auditInScope(user, audit, teamRows, pimpinanRows) {
  if (user.Role === 'ADMIN_BPM') return true;
  if (user.Role === 'AUDITI') return same(audit.AuditiType, user.RefType) && same(audit.AuditiID, user.RefID);
  if (user.Role === 'AUDITOR') {
    const team = teamRows.find(row => same(row.AuditID, audit.AuditID));
    return !!team && [team.LeadAuditorID, team.Member1ID, team.Member2ID].some(id => same(id, user.RefID));
  }
  if (user.Role === 'PIMPINAN') {
    const profile = pimpinanScope(user, pimpinanRows);
    if (!profile) return false;
    if (['YAYASAN', 'UNIVERSITAS'].includes(profile.level)) return true;
    if (profile.level === 'FAKULTAS') return clean(audit.Fakultas).toLowerCase() === clean(profile.accessName || profile.accessId).toLowerCase();
    return same(profile.accessType, audit.AuditiType) && same(profile.accessId, audit.AuditiID);
  }
  return false;
}

function applyStandardFilters(values, filters, adminMode) {
  filters = filters || {};
  let result = values.filter(row => adminMode || (truthy(row.Active) && (!clean(row.StatusStandar) || clean(row.StatusStandar).toUpperCase() === 'BERLAKU')));
  const status = clean(filters.status).toUpperCase();
  const group = clean(filters.kelompok);
  const year = Number(filters.tahun) || 0;
  const query = clean(filters.q).toLowerCase();
  if (status) result = result.filter(row => clean(row.StatusStandar).toUpperCase() === status);
  if (group) result = result.filter(row => same(row.Kelompok, group));
  if (year) result = result.filter(row => (!Number(row.TahunBerlakuMulai) || year >= Number(row.TahunBerlakuMulai)) && (!Number(row.TahunBerlakuSampai) || year <= Number(row.TahunBerlakuSampai)));
  if (query) result = result.filter(row => [row.ItemCode, row.NamaStandar, row.PernyataanStandar, row.Indikator, row.SumberFile, row.Versi].some(value => clean(value).toLowerCase().includes(query)));
  return result;
}

function standardUsage(standards, assignments, audits) {
  const auditMap = byId(audits, 'AuditID');
  const usage = {};
  assignments.filter(row => truthy(row.Active)).forEach(row => {
    const id = clean(row.StandardID);
    if (!id) return;
    const item = usage[id] || {total: 0, draft: 0, published: 0, final: 0};
    item.total += 1;
    const status = clean((auditMap[clean(row.AuditID)] || {}).Status);
    if (status === 'DRAFT BPM') item.draft += 1; else item.published += 1;
    if (status === 'FINAL') item.final += 1;
    usage[id] = item;
  });
  return usage;
}

function adminStandards(standards, assignments, audits, filters) {
  const usage = standardUsage(standards, assignments, audits);
  return applyStandardFilters(standards, filters, true).map(row => {
    const item = {...row};
    const use = usage[clean(row.StandardID)] || {total: 0, published: 0, final: 0};
    item.UsageTotal = use.total;
    item.UsagePublished = use.published;
    item.UsageFinal = use.final;
    item.Locked = use.total > 0;
    item.CanEditContent = use.total === 0;
    item.CanDelete = use.total === 0 && clean(row.StatusStandar) === 'DRAFT';
    return item;
  }).sort((left, right) => clean(left.ItemCode).localeCompare(clean(right.ItemCode)) || clean(left.Versi).localeCompare(clean(right.Versi), undefined, {numeric: true}));
}

function assignmentState(audit, assignments, self, evidence, desk, findings, visit, form2, form3, approvals, reports) {
  const auditId = clean(audit.AuditID);
  const started = [self, evidence, desk, findings, visit, form2, form3, approvals, reports].some(list => list.some(row => same(row.AuditID, auditId)));
  const draft = clean(audit.Status) === 'DRAFT BPM';
  const canEdit = draft && !started;
  const canReopen = !draft && !started;
  return {canEdit, canReopen, started, reason: canEdit || canReopen ? '' : started ? 'Audit sudah mulai diisi; penetapan terkunci.' : 'Penetapan terkunci pada status audit ini.'};
}

function teamWithNames(team, auditors) {
  if (!team) return {};
  const auditorMap = byId(auditors, 'AuditorID');
  const info = id => {
    const auditor = auditorMap[clean(id)];
    return auditor ? {id, nama: auditor.Nama, unit: auditor.Unit, sertifikasi: auditor.Sertifikasi} : {id, nama: id};
  };
  return {Lead: info(team.LeadAuditorID), Member1: info(team.Member1ID), Member2: info(team.Member2ID)};
}

function approvalMap(approvalRows) {
  const result = {};
  approvalRows.filter(row => truthy(row.Approved)).forEach(row => {
    const item = {...row};
    item.ApprovedAtDisplay = formatApprovalTime(row.ApprovedAt);
    result[clean(row.Stage)] = item;
  });
  return result;
}

function formatApprovalTime(value) {
  const text = clean(value);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]} ${match[4]}:${match[5]} WIB` : (text || '-');
}

function assignedStandards(assignments, standards, auditId) {
  const standardMap = byId(standards, 'StandardID');
  return assignments.filter(row => same(row.AuditID, auditId) && truthy(row.Active)).map(row => {
    const master = standardMap[clean(row.StandardID)] || {};
    const snapshot = {
      StandardID: row.StandardID,
      ItemCode: row.ItemCode || master.ItemCode,
      NamaStandar: row.NamaStandar || master.NamaStandar,
      Kelompok: row.KelompokSnapshot || master.Kelompok,
      KodeKelompokStandar: row.KodeKelompokSnapshot || master.KodeKelompokStandar,
      PernyataanStandar: row.PernyataanStandarSnapshot || master.PernyataanStandar,
      StrategiPencapaian: row.StrategiSnapshot || master.StrategiPencapaian,
      Indikator: row.IndikatorSnapshot || master.Indikator,
      SumberFile: row.SumberFileSnapshot || master.SumberFile,
      TahunSumber: row.TahunSumberSnapshot || master.TahunSumber,
      SourceHash: row.SourceHashSnapshot || master.SourceHash,
      Versi: row.VersiStandarSnapshot || master.Versi,
      TahunBerlakuMulai: row.TahunBerlakuSnapshot || master.TahunBerlakuMulai
    };
    return {...row, standard: snapshot};
  });
}

function validateWorkspace(audit, assigned, selfEval, desk, findings) {
  const errors = [];
  const selfByAssign = byId(selfEval, 'AssignID');
  assigned.forEach(item => {
    const self = selfByAssign[clean(item.AssignID)] || {};
    if (!clean(self.Capaian)) errors.push(`${item.ItemCode || item.AssignID}: Evaluasi Diri belum diisi.`);
  });
  return {ok: errors.length === 0, errors, warnings: []};
}

async function readRows(pool, schema, names) {
  const result = await Promise.all(names.map(name => rows(pool, schema, name)));
  return Object.fromEntries(names.map((name, index) => [name, result[index]]));
}

async function listStandardsAdmin(pool, schema, user, filters) {
  requireAdmin(user);
  const data = await readRows(pool, schema, ['MASTER_STANDAR', 'AMI_STANDARD_ASSIGN', 'AMI_AUDITI']);
  return adminStandards(data.MASTER_STANDAR, data.AMI_STANDARD_ASSIGN, data.AMI_AUDITI, filters);
}

async function listStandards(pool, schema, user, filters) {
  requireAdmin(user);
  const data = await rows(pool, schema, 'MASTER_STANDAR');
  return applyStandardFilters(data, filters, false).map(row => ({...row}));
}

async function getStandardVersions(pool, schema, user, standardId) {
  requireAdmin(user);
  const data = await readRows(pool, schema, ['MASTER_STANDAR', 'AMI_STANDARD_ASSIGN', 'AMI_AUDITI']);
  const selected = data.MASTER_STANDAR.find(row => same(row.StandardID, standardId));
  if (!selected) throw new Error('Standar tidak ditemukan.');
  const family = clean(selected.StandardFamilyID) || `STDFAM-${clean(selected.StandardID)}`;
  return adminStandards(data.MASTER_STANDAR, data.AMI_STANDARD_ASSIGN, data.AMI_AUDITI).filter(row => (clean(row.StandardFamilyID) || `STDFAM-${clean(row.StandardID)}`) === family);
}

async function listUsers(pool, schema, user) {
  requireAdmin(user);
  return (await rows(pool, schema, 'USERS')).map(row => ({UserID: row.UserID, Username: row.Username, Nama: row.Nama, Role: row.Role, RefType: row.RefType, RefID: row.RefID, Active: truthy(row.Active), ForceChangePassword: truthy(row.ForceChangePassword), LastLogin: row.LastLogin || ''}));
}

async function listCycles(pool, schema, user) {
  requireAdmin(user);
  return rows(pool, schema, 'AMI_CYCLE');
}

async function listCycleAudits(pool, schema, user, cycleId) {
  requireAdmin(user);
  const data = await readRows(pool, schema, ['AMI_AUDITI', 'AMI_STANDARD_ASSIGN', 'AMI_TEAM', 'SELF_EVAL', 'EVIDENCE', 'DESK_EVAL', 'FINDINGS', 'VISIT', 'FORM2_PROGRAM_KERJA', 'FORM3_CATATAN', 'APPROVAL', 'REPORT_LOG']);
  const teamMap = byId(data.AMI_TEAM, 'AuditID');
  return data.AMI_AUDITI.filter(row => same(row.CycleID, cycleId)).map(row => {
    const state = assignmentState(row, data.AMI_STANDARD_ASSIGN, data.SELF_EVAL, data.EVIDENCE, data.DESK_EVAL, data.FINDINGS, data.VISIT, data.FORM2_PROGRAM_KERJA, data.FORM3_CATATAN, data.APPROVAL, data.REPORT_LOG);
    return {...row, StandardCount: data.AMI_STANDARD_ASSIGN.filter(item => same(item.AuditID, row.AuditID) && truthy(item.Active)).length, Team: {...(teamMap[clean(row.AuditID)] || {})}, CanEditAssignment: state.canEdit, CanReopenAssignment: state.canReopen, AssignmentStarted: state.started, AssignmentLockReason: state.reason};
  });
}

async function getAccessibleAudits(pool, schema, user) {
  const data = await readRows(pool, schema, ['AMI_AUDITI', 'AMI_TEAM', 'MASTER_PIMPINAN', 'AMI_STANDARD_ASSIGN', 'SELF_EVAL', 'DESK_EVAL', 'FINDINGS']);
  const audits = data.AMI_AUDITI.filter(row => auditInScope(user, row, data.AMI_TEAM, data.MASTER_PIMPINAN));
  return audits.map(audit => {
    const id = clean(audit.AuditID);
    return {...audit,
      StandardCount: data.AMI_STANDARD_ASSIGN.filter(row => same(row.AuditID, id) && truthy(row.Active)).length,
      SelfDone: data.SELF_EVAL.filter(row => same(row.AuditID, id) && clean(row.Capaian)).length,
      DeskDone: data.DESK_EVAL.filter(row => same(row.AuditID, id) && clean(row.StatusDesk)).length,
      Assessed: data.FINDINGS.filter(row => same(row.AuditID, id) && clean(row.Kategori)).length};
  });
}

async function getAuditWorkspace(pool, schema, user, auditId) {
  const data = await readRows(pool, schema, ['AMI_AUDITI', 'AMI_CYCLE', 'AMI_TEAM', 'MASTER_PIMPINAN', 'MASTER_AUDITOR', 'MASTER_STANDAR', 'AMI_STANDARD_ASSIGN', 'SELF_EVAL', 'EVIDENCE', 'DESK_EVAL', 'FINDINGS', 'SELF_FOLLOW_UP', 'AMI_IMPROVEMENT', 'VISIT', 'FORM2_PROGRAM_KERJA', 'FORM3_CATATAN', 'APPROVAL', 'REPORT_LOG']);
  const audit = data.AMI_AUDITI.find(row => same(row.AuditID, auditId));
  if (!audit) throw new Error('Audit tidak ditemukan.');
  if (!auditInScope(user, audit, data.AMI_TEAM, data.MASTER_PIMPINAN)) {
    const error = new Error('Anda tidak memiliki akses ke audit ini.'); error.status = 403; throw error;
  }
  const id = clean(auditId);
  const assigned = assignedStandards(data.AMI_STANDARD_ASSIGN, data.MASTER_STANDAR, id);
  const selfEval = data.SELF_EVAL.filter(row => same(row.AuditID, id));
  const evidence = data.EVIDENCE.filter(row => same(row.AuditID, id));
  const desk = data.DESK_EVAL.filter(row => same(row.AuditID, id));
  const findings = data.FINDINGS.filter(row => same(row.AuditID, id));
  const selfFollowUps = data.SELF_FOLLOW_UP.filter(row => same(row.AuditID, id));
  const improvements = data.AMI_IMPROVEMENT.filter(row => same(row.AuditID, id));
  const team = data.AMI_TEAM.find(row => same(row.AuditID, id));
  const auditTeam = teamWithNames(team, data.MASTER_AUDITOR);
  const permissions = {canSelf: user.Role === 'AUDITI', canAudit: user.Role === 'AUDITOR', isLead: user.Role === 'AUDITOR' && team && same(team.LeadAuditorID, user.RefID), canBpm: user.Role === 'ADMIN_BPM', canAuditiApprove: user.Role === 'AUDITI', canPimpinanApprove: user.Role === 'PIMPINAN', readOnly: ['PIMPINAN', 'ADMIN_BPM'].includes(user.Role)};
  const cycle = data.AMI_CYCLE.find(row => same(row.CycleID, audit.CycleID)) || {};
  return {audit: {...audit}, cycle: {...cycle}, team: auditTeam, assigned, selfEval, evidence, desk, findings, selfFollowUps, improvements,
    visit: {...(data.VISIT.find(row => same(row.AuditID, id)) || {})}, form2: {...(data.FORM2_PROGRAM_KERJA.find(row => same(row.AuditID, id)) || {})}, form3: {...(data.FORM3_CATATAN.find(row => same(row.AuditID, id)) || {})},
    approvals: approvalMap(data.APPROVAL.filter(row => same(row.AuditID, id))), reports: data.REPORT_LOG.filter(row => same(row.AuditID, id)).map(row => ({...row})), validation: validateWorkspace(audit, assigned, selfEval, desk, findings), permissions};
}

module.exports = {listStandardsAdmin, listStandards, listCycleAudits, listUsers, getAccessibleAudits, getAuditWorkspace, getStandardVersions, listCycles, requireAdmin};

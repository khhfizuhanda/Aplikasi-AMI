const clean = value => String(value ?? '').trim();
const truthy = value => value === true || ['true', '1', 'yes'].includes(clean(value).toLowerCase());
const same = (a, b) => clean(a) === clean(b);
const byId = (rows, key) => Object.fromEntries(rows.map(row => [clean(row[key]), row]));

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
  if (user.Role !== 'ADMIN_BPM' && !clean(user.RefID)) return false;
  if (user.Role === 'AUDITI') return same(audit.AuditiType, user.RefType) && same(audit.AuditiID, user.RefID);
  if (user.Role === 'AUDITOR') {
    const team = teamRows.find(row => same(row.AuditID, audit.AuditID));
    return !!team && [team.LeadAuditorID, team.Member1ID, team.Member2ID].some(id => same(id, user.RefID));
  }
  if (user.Role === 'PIMPINAN') {
    const profile = pimpinanScope(user, pimpinanRows);
    if (!profile) return false;
    if (['YAYASAN', 'UNIVERSITAS'].includes(profile.level)) return true;
    if (!profile.accessId && !profile.accessName) return false;
    if (profile.level === 'FAKULTAS') return clean(audit.Fakultas).toLowerCase() === clean(profile.accessName || profile.accessId).toLowerCase();
    return same(profile.accessType, audit.AuditiType) && same(profile.accessId, audit.AuditiID);
  }
  return false;
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


export {auditInScope, teamWithNames, approvalMap, assignedStandards, validateWorkspace};

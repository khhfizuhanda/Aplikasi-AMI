const clean = value => String(value == null ? '' : value).trim();
const table = (schema, name) => `"${String(schema).replace(/"/g, '""')}"."${name}"`;

function canAccess(user, audit, teams, pimpinan) {
  if (user.Role === 'ADMIN_BPM') return true;
  if (user.Role === 'AUDITI') return clean(audit.AuditiType) === clean(user.RefType) && clean(audit.AuditiID) === clean(user.RefID);
  if (user.Role === 'AUDITOR') { const team = teams.find(row => clean(row.AuditID) === clean(audit.AuditID)); return !!team && [team.LeadAuditorID, team.Member1ID, team.Member2ID].some(id => clean(id) === clean(user.RefID)); }
  if (user.Role === 'PIMPINAN') { const profile = pimpinan.find(row => clean(row.PimpinanID) === clean(user.RefID) && ['true','1','yes'].includes(clean(row.Active).toLowerCase())); if (!profile) return false; const level = clean(profile.Level).toUpperCase(); if (['YAYASAN','UNIVERSITAS'].includes(level)) return true; if (level === 'FAKULTAS') return clean(audit.Fakultas).toLowerCase() === clean(profile.AccessName || profile.AccessID).toLowerCase(); return clean(profile.AccessType || level) === clean(audit.AuditiType) && clean(profile.AccessID || profile.UnitID) === clean(audit.AuditiID); }
  return false;
}

async function listReports(pool, schema, user) {
  const [reports, audits, teams, pimpinan] = await Promise.all(['REPORT_LOG','AMI_AUDITI','AMI_TEAM','MASTER_PIMPINAN'].map(name => pool.query(`SELECT * FROM ${table(schema, name)}`).then(result => result.rows)));
  const allowed = new Map(audits.filter(audit => canAccess(user, audit, teams, pimpinan)).map(audit => [clean(audit.AuditID), audit]));
  return reports.filter(report => allowed.has(clean(report.AuditID))).map(report => ({...report, AuditiName:allowed.get(clean(report.AuditID)).AuditiName, Jenjang:allowed.get(clean(report.AuditID)).Jenjang, CreatedAtDisplay:clean(report.CreatedAt) || '-'})).sort((left, right) => clean(right.CreatedAt).localeCompare(clean(left.CreatedAt)));
}

function unsupportedDriveFeature(name) { const error = new Error(`${name} tidak tersedia pada backend lokal PostgreSQL karena memerlukan Google Drive.`); error.status = 501; throw error; }
function downloadReportFile() { return unsupportedDriveFeature('downloadReportFile'); }
function generateAmiFinalReport() { return unsupportedDriveFeature('generateAmiFinalReport'); }
function downloadEvidenceFile() { return unsupportedDriveFeature('downloadEvidenceFile'); }

module.exports = {listReports,downloadReportFile,generateAmiFinalReport,downloadEvidenceFile};

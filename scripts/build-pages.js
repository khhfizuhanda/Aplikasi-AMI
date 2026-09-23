const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'docs');
const apiBase = process.env.AMI_API_BASE || 'https://iabubetffbzsjestjqxp.supabase.co/functions/v1/ami-api';
const pagesBase = process.env.AMI_PAGES_BASE || 'https://khhfizuhanda.github.io/Aplikasi-AMI/';
const template = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const logoFile = 'logo BPM.png';
const logoPath = path.join(root, logoFile);
const publicLogo = encodeURI(logoFile);
const html = template
  .replaceAll('<?= appName ?>', 'Sistem Audit Mutu Internal (AMI) 2026')
  .replaceAll('<?= initialView ?>', 'public')
  .replaceAll('<?= webAppUrl ?>', pagesBase)
  .replaceAll('<?= orgName ?>', 'Universitas Medan Area')
  .replaceAll('<?= unitName ?>', 'Biro Penjaminan Mutu')
  .replaceAll('<?= appVersion ?>', '1.6.2-pages')
  .replaceAll('<?!= bpmLogo ?>', publicLogo)
  .replaceAll('<?!= spmiLogo ?>', publicLogo)
  .replaceAll('<?!= campusHero ?>', '')
  .replace("<?!= JSON.stringify(webAppUrl || '') ?>", JSON.stringify(pagesBase))
  .replace("<?= initialView === 'login' ? 'hidden' : '' ?>", '')
  .replace("<?= initialView === 'login' ? '' : 'hidden' ?>", 'hidden')
  .replace('<head>', `<head><script>window.AMI_EDGE_BACKEND=true;window.AMI_API_BASE=${JSON.stringify(apiBase)};</script>`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
if (fs.existsSync(logoPath)) fs.copyFileSync(logoPath, path.join(outputDir, logoFile));
console.log(`GitHub Pages build created at ${path.relative(root, outputDir)} using ${apiBase}`);
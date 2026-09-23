const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const outputDir = path.join(root, 'docs');
const apiBase = process.env.AMI_API_BASE || 'https://aplikasi-ami.onrender.com';
const template = fs.readFileSync(path.join(root, 'Index.html'), 'utf8');
const html = template
  .replaceAll('<?= appName ?>', 'Sistem Audit Mutu Internal (AMI) 2026')
  .replaceAll('<?= initialView ?>', 'public')
  .replaceAll('<?= webAppUrl ?>', apiBase + '/')
  .replaceAll('<?= orgName ?>', 'Universitas Medan Area')
  .replaceAll('<?= unitName ?>', 'Biro Penjaminan Mutu')
  .replaceAll('<?= appVersion ?>', '1.6.2-pages')
  .replaceAll('<?!= bpmLogo ?>', '')
  .replaceAll('<?!= spmiLogo ?>', '')
  .replaceAll('<?!= campusHero ?>', '')
  .replace("<?!= JSON.stringify(webAppUrl || '') ?>", JSON.stringify(apiBase + '/'))
  .replace("<?= initialView === 'login' ? 'hidden' : '' ?>", '')
  .replace("<?= initialView === 'login' ? '' : 'hidden' ?>", 'hidden')
  .replace('<head>', `<head><script>window.AMI_RENDER_BACKEND=true;window.AMI_API_BASE=${JSON.stringify(apiBase)};</script>`);

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(path.join(outputDir, 'index.html'), html);
fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');
console.log(`GitHub Pages build created at ${path.relative(root, outputDir)} using ${apiBase}`);
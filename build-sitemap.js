
const fs = require('fs');
const path = require('path');

const DOMAIN = 'https://refactor-room.pages.dev';
const KEY = '142c604b064d4ad3ba0d08e830c36ef3';

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const URLS_FILE = path.join(ROOT, 'urls.txt');
const ROOT_REDIRECTS = path.join(ROOT, '_redirects');
const PUBLIC_REDIRECTS = path.join(PUBLIC_DIR, '_redirects');
const ROOT_KEY = path.join(ROOT, `${KEY}.txt`);
const PUBLIC_KEY = path.join(PUBLIC_DIR, `${KEY}.txt`);
const SITEMAP_FILE = path.join(PUBLIC_DIR, 'sitemap.xml');

if (!fs.existsSync(URLS_FILE)) {
  throw new Error('urls.txt is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_REDIRECTS)) {
  throw new Error('Root _redirects file is missing. Deployment stopped.');
}

if (!fs.existsSync(ROOT_KEY)) {
  throw new Error('Existing IndexNow key file is missing. Deployment stopped.');
}

if (fs.readFileSync(ROOT_KEY, 'utf8').trim() !== KEY) {
  throw new Error('IndexNow key file content does not match the configured key.');
}

const redirectContent = fs.readFileSync(ROOT_REDIRECTS, 'utf8');
const redirectRules = redirectContent
  .split(/\r?\n/)
  .filter(line => line.trim() && !line.trim().startsWith('#'));

if (redirectRules.length > 2000) {
  throw new Error(`Redirect validation failed: ${redirectRules.length} rules.`);
}

const rawUrls = fs.readFileSync(URLS_FILE, 'utf8')
  .split(/\r?\n/)
  .map(line => line.trim())
  .filter(Boolean);

const urls = new Set();

for (const value of rawUrls) {
  let url;

  try {
    url = new URL(value);
  } catch {
    throw new Error(`Invalid URL in urls.txt: ${value}`);
  }

  if (
    url.hostname.toLowerCase() !== 'refactor-room.pages.dev' ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`Unexpected URL in urls.txt: ${value}`);
  }

  url.protocol = 'https:';
  url.pathname = '/' + url.pathname.split('/').filter(Boolean).join('/');

  urls.add(url.href);
}

if (urls.size === 0) {
  throw new Error('No valid URLs found. Deployment stopped.');
}

function escapeXml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const lastmod = new Date().toISOString();

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

for (const url of urls) {
  xml += '  <url>\n';
  xml += `    <loc>${escapeXml(url)}</loc>\n`;
  xml += `    <lastmod>${lastmod}</lastmod>\n`;
  xml += '    <changefreq>hourly</changefreq>\n';
  xml += '  </url>\n';
}

xml += '</urlset>\n';

fs.mkdirSync(PUBLIC_DIR, { recursive: true });

// Copy the original redirect rules unchanged into the deployed folder.
fs.copyFileSync(ROOT_REDIRECTS, PUBLIC_REDIRECTS);

// Copy the verified IndexNow key into the deployed folder.
fs.copyFileSync(ROOT_KEY, PUBLIC_KEY);

fs.writeFileSync(SITEMAP_FILE, xml, 'utf8');

// Verify deployment artifacts.
if (
  fs.readFileSync(PUBLIC_REDIRECTS, 'utf8') !== redirectContent
) {
  throw new Error('Redirect file verification failed.');
}

if (fs.readFileSync(PUBLIC_KEY, 'utf8').trim() !== KEY) {
  throw new Error('Deployed IndexNow key verification failed.');
}

if (!xml.includes('<lastmod>') ||
    !xml.includes('<changefreq>hourly</changefreq>')) {
  throw new Error('Sitemap tags are missing.');
}

console.log(`Sitemap generated: ${urls.size} URLs`);
console.log(`lastmod: ${lastmod}`);
console.log('changefreq: hourly');
console.log(`Redirect rules copied: ${redirectRules.length}`);
console.log('All build checks passed.');

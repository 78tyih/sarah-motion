import fs from 'node:fs';
import path from 'node:path';

const root = import.meta.dirname;
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');

const b64 = fs.readFileSync(path.join(root, 'fonts', 'geist-latin.woff2')).toString('base64');
const engine = fs.readFileSync(path.join(src, 'engine.js'), 'utf8');

const fontCss = `@font-face{font-family:'Geist';font-style:normal;font-weight:100 900;font-display:block;` +
  `src:url(data:font/woff2;base64,${b64}) format('woff2');` +
  `unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`;

fs.mkdirSync(dist, { recursive: true });

for (const name of ['morph.template.html', 'library.template.html']) {
  let html = fs.readFileSync(path.join(src, name), 'utf8');
  html = html.replace('/*__FONT__*/', fontCss).replace('/*__ENGINE__*/', engine);
  if (html.includes('__FONT__') || html.includes('__ENGINE__')) throw new Error('placeholder left in ' + name);
  const out = path.join(dist, name.replace('.template', ''));
  fs.writeFileSync(out, html);
  console.log(out, (html.length / 1024).toFixed(1) + ' KB');
}

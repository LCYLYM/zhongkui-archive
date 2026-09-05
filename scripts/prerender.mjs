import { createServer } from 'vite';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
const project = resolve(import.meta.dirname, '..');
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const server = await createServer({ root:project, server:{middlewareMode:true}, appType:'custom' });
try {
  const { routes, render } = await server.ssrLoadModule('/src/entry-server.jsx');
  const template = await readFile(join(project,'dist/index.html'),'utf8');
  const paths = routes();
  for (const path of paths) {
    const page = render(path);
    const head = `${page.noindex ? '<meta name="robots" content="noindex,follow"/>' : ''}<title>${escape(page.title)}</title>\n<meta name="description" content="${escape(page.description)}"/>\n<link rel="canonical" href="${escape(page.canonical)}"/>\n${page.alternates.map(item => `<link rel="alternate" hreflang="${item.lang}" href="${escape(item.href)}"/>`).join('\n')}\n<link rel="alternate" hreflang="x-default" href="${escape(page.alternates[0].href)}"/>\n<meta property="og:type" content="website"/>\n<meta property="og:title" content="${escape(page.title)}"/>\n<meta property="og:description" content="${escape(page.description)}"/>\n<meta property="og:url" content="${escape(page.canonical)}"/>\n<meta property="og:image" content="${escape(page.image)}"/>\n<meta name="twitter:card" content="summary_large_image"/>\n<script type="application/ld+json">${JSON.stringify(page.schema).replace(/</g,'\\u003c')}</script>`;
    const html = template.replace(/<title>[\s\S]*?<\/title>/,'').replace(/<meta name="description"[^>]*>/g,'').replace('<html lang="zh-CN">',`<html lang="${page.locale === 'zh' ? 'zh-CN' : 'en'}" data-locale="${page.locale}">`).replace('</head>',`${head}\n</head>`).replace('<div id="root"></div>',`<div id="root" data-rendered="true">${page.html}</div>`);
    const directory = join(project, 'dist', path.slice(1)); await mkdir(directory, { recursive:true }); await writeFile(join(directory,'index.html'),html);
  }
  const canonicalPaths = paths.filter(path => path !== '/' && !path.endsWith('/saved/'));
  await writeFile(join(project,'dist/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${canonicalPaths.map(path => `<url><loc>https://zk.syal.site${escape(path)}</loc></url>`).join('')}</urlset>\n`);
  await writeFile(join(project,'dist/robots.txt'),'User-agent: *\nAllow: /\nDisallow: /zh/saved/\nDisallow: /en/saved/\nSitemap: https://zk.syal.site/sitemap.xml\n');
  console.log(`Prerendered ${paths.length} content pages, canonical URLs, language alternates and sitemap.`);
} finally { await server.close(); }

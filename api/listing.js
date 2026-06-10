// Serverless function: server-side inject SEO/OG/Twitter tags + Product JSON-LD
// into listing.html so crawlers and social scrapers (which do NOT run JS) see
// real listing data. Routed via vercel.json so /listing.html?id=... hits this.

const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://gyftwcdsxjxswazdwnzu.supabase.co';
// Publishable anon key (same one already public in js/config.js — safe to ship).
const SUPABASE_ANON_KEY = 'sb_publishable_zSZYSEJTTJpcL36KmktZdA_K8Ogn81Q';
const SITE = 'https://www.usedmotorcyclegear.com';

let TEMPLATE = null;
function getTemplate() {
  if (TEMPLATE) return TEMPLATE;
  const candidates = [
    path.join(process.cwd(), 'listing.html'),
    path.join(__dirname, '..', 'listing.html'),
    path.join(__dirname, 'listing.html'),
  ];
  for (const p of candidates) {
    try { TEMPLATE = fs.readFileSync(p, 'utf8'); return TEMPLATE; } catch (e) { /* try next */ }
  }
  return null;
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

module.exports = async (req, res) => {
  let html = getTemplate();
  if (!html) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('Listing template unavailable.');
  }

  const id = (req.query && (req.query.id || req.query.ID)) || '';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  // CDN-cache per-URL (per id) for 5 min, serve stale while revalidating.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (!id) { res.statusCode = 200; return res.end(html); }

  let listing = null;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/listings?id=eq.${encodeURIComponent(id)}&select=id,title,description,price,category,condition,status,images`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (r.ok) { const rows = await r.json(); listing = Array.isArray(rows) ? rows[0] : null; }
  } catch (e) { /* fall through to unmodified template */ }

  if (!listing) { res.statusCode = 200; return res.end(html); }

  const url = `${SITE}/listing.html?id=${esc(listing.id)}`;
  const img = (listing.images && listing.images[0]) ? listing.images[0] : `${SITE}/og-image.jpg`;
  const priceNum = Number(listing.price) || 0;
  const priceStr = priceNum.toLocaleString('en-US');
  const title = `${listing.title} — Used ${listing.category} | UsedMotorcycleGear.com`;
  const desc = `${listing.condition} used ${listing.category} for sale — $${priceStr}. ${(listing.description || '')}`
    .replace(/\s+/g, ' ').trim().slice(0, 160);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title,
    description: listing.description || desc,
    image: Array.isArray(listing.images) && listing.images.length ? listing.images : [img],
    category: listing.category,
    offers: {
      '@type': 'Offer',
      price: priceNum,
      priceCurrency: 'USD',
      availability: listing.status === 'active' ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut',
      url: url,
      itemCondition: listing.condition === 'New' ? 'https://schema.org/NewCondition' : 'https://schema.org/UsedCondition',
    },
  };

  // Replace title + description that already exist in the static template.
  html = html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${esc(desc)}" />`);
  // Replace the static og:image so we don't emit a duplicate.
  html = html.replace(/<meta\s+property="og:image"[^>]*>/i, `<meta property="og:image" content="${esc(img)}" />`);

  const inject = [
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(listing.title)} — $${esc(priceStr)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:price:amount" content="${esc(String(priceNum))}" />`,
    `<meta property="og:price:currency" content="USD" />`,
    `<meta name="twitter:title" content="${esc(listing.title)} — $${esc(priceStr)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(img)}" />`,
    `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>`,
  ].join('\n  ');

  html = html.replace('</head>', `  ${inject}\n</head>`);

  res.statusCode = 200;
  res.end(html);
};

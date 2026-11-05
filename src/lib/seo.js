const config = require('../../config');

const SITE_DESCRIPTION = 'Văn Hay – kho truyện cổ tích, ngụ ngôn, truyền thuyết, thần thoại và thơ cho bé, được biên tập lại bằng AI.';

function stripHtml(html) {
    return String(html || '').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

function truncate(text, max) {
    if (text.length <= max) return text;
    return text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
}

function absoluteUrl(pathOrUrl) {
    if (!pathOrUrl) return undefined;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    return config.siteUrl + (pathOrUrl.startsWith('/') ? '' : '/') + pathOrUrl;
}

function pageTitle(title) {
    return title ? `${title} | ${config.siteName}` : `${config.siteName} | Tinh hoa chữ Việt`;
}

function homeSeo() {
    return {
        title: pageTitle(),
        description: SITE_DESCRIPTION,
        canonical: config.siteUrl + '/',
        jsonLd: [{
            '@context': 'https://schema.org',
            '@type': 'WebSite',
            name: config.siteName,
            url: config.siteUrl + '/',
            inLanguage: 'vi',
            potentialAction: {
                '@type': 'SearchAction',
                target: `${config.siteUrl}/tim-kiem?q={search_term_string}`,
                'query-input': 'required name=search_term_string'
            }
        }]
    };
}

function categorySeo(menuItem, page, totalPages) {
    const url = (n) => config.siteUrl + menuItem.href + (n > 1 ? `?page=${n}` : '');
    const suffix = page > 1 ? ` – Trang ${page}` : '';
    return {
        title: pageTitle(menuItem.name + suffix),
        description: `${menuItem.name} hay nhất: đọc online miễn phí, nội dung được biên tập lại bằng AI tại ${config.siteName}.${suffix}`,
        canonical: url(page),
        prev: page > 1 ? url(page - 1) : undefined,
        next: page < totalPages ? url(page + 1) : undefined
    };
}

function workSeo(work, menuItem) {
    const description = truncate(stripHtml(work.excerpt) || stripHtml(work.content), 160) || SITE_DESCRIPTION;
    const canonical = `${config.siteUrl}/${work.slug}`;
    const image = absoluteUrl(work.thumbnail);
    const hasAuthor = work.author && work.author !== 'Sưu tầm';

    const crumbs = [{ name: 'Trang chủ', url: config.siteUrl + '/' }];
    if (menuItem) crumbs.push({ name: menuItem.name, url: config.siteUrl + menuItem.href });
    crumbs.push({ name: work.title, url: canonical });

    return {
        title: pageTitle(work.title),
        description,
        canonical,
        image,
        type: 'article',
        jsonLd: [
            {
                '@context': 'https://schema.org',
                '@type': 'Article',
                headline: work.title,
                description,
                image: image ? [image] : undefined,
                inLanguage: 'vi',
                datePublished: work.createdAt ? new Date(work.createdAt).toISOString() : undefined,
                dateModified: work.updatedAt ? new Date(work.updatedAt).toISOString() : undefined,
                mainEntityOfPage: canonical,
                author: hasAuthor
                    ? { '@type': 'Person', name: work.author }
                    : { '@type': 'Organization', name: config.siteName },
                publisher: { '@type': 'Organization', name: config.siteName, url: config.siteUrl }
            },
            {
                '@context': 'https://schema.org',
                '@type': 'BreadcrumbList',
                itemListElement: crumbs.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: c.url }))
            }
        ]
    };
}


function novelsSeo() {
    return {
        title: pageTitle('Truyện dài'),
        description: 'Truyện dài nhiều chương, đọc online miễn phí tại ' + config.siteName + '.',
        canonical: config.siteUrl + '/sach'
    };
}

function novelSeo(novel, page, totalPages) {
    const url = (n) => `${config.siteUrl}/sach/${novel.slug}${n > 1 ? `?page=${n}` : ''}`;
    const description = truncate(stripHtml(novel.synopsis), 160) || SITE_DESCRIPTION;
    return {
        title: pageTitle(novel.title + (page > 1 ? ` – Trang ${page}` : '')),
        description,
        canonical: url(page),
        prev: page > 1 ? url(page - 1) : undefined,
        next: page < totalPages ? url(page + 1) : undefined,
        image: absoluteUrl(novel.thumbnail),
        type: 'book',
        jsonLd: [{
            '@context': 'https://schema.org',
            '@type': 'Book',
            name: novel.title,
            description,
            inLanguage: 'vi',
            author: { '@type': 'Person', name: novel.author },
            url: url(1)
        }]
    };
}

function chapterSeo(novel, chapter) {
    const canonical = `${config.siteUrl}/sach/${novel.slug}/chuong-${chapter.no}`;
    const description = truncate(stripHtml(chapter.content), 160) || truncate(stripHtml(novel.synopsis), 160) || SITE_DESCRIPTION;
    return {
        title: pageTitle(`${novel.title} – Chương ${chapter.no}: ${chapter.title}`),
        description,
        canonical,
        type: 'article',
        jsonLd: [{
            '@context': 'https://schema.org',
            '@type': 'Chapter',
            name: chapter.title,
            position: chapter.no,
            inLanguage: 'vi',
            url: canonical,
            isPartOf: { '@type': 'Book', name: novel.title, url: `${config.siteUrl}/sach/${novel.slug}` },
            dateModified: chapter.updatedAt ? new Date(chapter.updatedAt).toISOString() : undefined
        }]
    };
}

function searchSeo(q) {
    return {
        title: pageTitle(q ? `Kết quả cho “${q}”` : 'Tìm kiếm'),
        description: SITE_DESCRIPTION,
        noindex: true
    };
}

function notFoundSeo() {
    return { title: pageTitle('Không tìm thấy trang'), description: SITE_DESCRIPTION, noindex: true };
}

function xmlEscape(text) {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

// entries: [{ path, lastmod?: Date }]
function buildSitemap(entries) {
    const urls = entries.map((e) => {
        const lastmod = e.lastmod ? `<lastmod>${new Date(e.lastmod).toISOString()}</lastmod>` : '';
        return `  <url><loc>${xmlEscape(config.siteUrl + e.path)}</loc>${lastmod}</url>`;
    });
    return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`;
}

function robotsTxt() {
    return `User-agent: *\nAllow: /\nDisallow: /tim-kiem\n\nSitemap: ${config.siteUrl}/sitemap.xml\n`;
}

module.exports = { homeSeo, categorySeo, workSeo, novelsSeo, novelSeo, chapterSeo, searchSeo, notFoundSeo, buildSitemap, robotsTxt, stripHtml };

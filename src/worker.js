import { escHtml, escAttr, handleSubmit, computeTurnstileTheme } from './worker-utils.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/api/submit') {
            return handleSubmit(request, env);
        }

        if (request.method === 'GET') {
            // Let known asset extensions pass through to static files
            if (/\.(css|js|json|ico|png|jpg|jpeg|svg|webp|woff2?)$/i.test(url.pathname)) {
                return env.ASSETS.fetch(request);
            }
            if (url.pathname === '/terms' || url.pathname === '/privacy') {
                return renderLegalPage(env, url);
            }
            return renderPage(env, url);
        }

        return env.ASSETS.fetch(request);
    }
};

async function renderPage(env, url) {
    try {
        const contentRes = await env.ASSETS.fetch(new Request(new URL('/content.json', url).href));
        if (!contentRes.ok) return new Response('Not found', { status: 404 });

        const content = await contentRes.json();

        let siteImages = [];
        try {
            const imagesRes = await env.ASSETS.fetch(new Request(new URL('/images.json', url).href));
            if (imagesRes.ok) siteImages = await imagesRes.json();
        } catch { /* no images yet */ }

        const biz = content.business || {};
        const formCfg = content.form || {};
        if (!formCfg.thankYouSub && formCfg.thankYouSubtext) formCfg.thankYouSub = formCfg.thankYouSubtext;
        if (!formCfg.thankYouSubtext && formCfg.thankYouSub) formCfg.thankYouSubtext = formCfg.thankYouSub;

        // Resolve current page from URL slug
        const slug = url.pathname.replace(/^\/+/, '').replace(/\/.*$/, '') || 'home';
        const pageData = (content.pages && content.pages[slug]) || null;
        if (!pageData && slug !== 'home') {
            return new Response('Page not found', { status: 404 });
        }
        const sections = (pageData && pageData.sections) || [];
        const nav = Array.isArray(content.nav) ? content.nav : [];
        const phone = biz.phone || '';
        const phoneHref = biz.phoneHref || (phone ? `tel:${phone.replace(/\D/g, '')}` : '#');

        const titleText = (pageData && pageData.title) || (content.meta && content.meta.title) || biz.name || '';
        const description = (pageData && pageData.description) || (content.meta && content.meta.description) || '';
        const canonical = url.origin + url.pathname;

        // ── Build content fragments ───────────────────────────────────────────

        const navHtml = nav.map(item =>
            `<li><a class="nav-link" href="${escAttr(item.href || '#')}">${escHtml(item.label || '')}</a></li>`
        ).join('');

        const sectionsHtml = sections.map((sec, idx) => renderSection(sec, idx)).join('\n');

        const serviceAreas = (content.contact && content.contact.serviceAreas) || [];
        const areasText = serviceAreas.join(', ');
        const areasListHtml = serviceAreas.map(a => `<li>${escHtml(a)}</li>`).join('');

        const hours = (content.contact && content.contact.hours) || [];
        const hoursHtml = `<strong>Hours</strong>${hours.map(h => `<span>${escHtml(h)}</span>`).join('')}`;

        const footerSvc = sections.find(s => s.items && s.items.length > 0 && !s.items[0].quote);
        const footerSvcHtml = footerSvc ? footerSvc.items.map(item =>
            `<li><a href="#${escAttr(footerSvc.id || 'services')}">${escHtml(item.title || '')}</a></li>`
        ).join('') : '';

        let fieldsHtml = '';
        if (formCfg.fields) {
            fieldsHtml = formCfg.fields.map(field => {
                const id = `contact-${field.name}`;
                const req = field.required ? ' required' : '';
                const autocompleteMap = { name: 'name', email: 'email', phone: 'tel', company: 'organization' };
                const ac = autocompleteMap[field.name] ? ` autocomplete="${autocompleteMap[field.name]}"` : '';
                let inputHtml;
                if (field.type === 'textarea') {
                    inputHtml = `<textarea id="${id}" name="${escAttr(field.name)}" rows="${field.rows || 4}" placeholder="${escAttr(field.placeholder || '')}"${req}></textarea>`;
                } else if (field.type === 'select') {
                    const opts = (field.options || []).map(o =>
                        `<option value="${escAttr(String(o.value))}">${escHtml(String(o.label))}</option>`
                    ).join('');
                    inputHtml = `<select id="${id}" name="${escAttr(field.name)}"${req}><option value="">${escHtml(field.placeholder || 'Select\u2026')}</option>${opts}</select>`;
                } else {
                    inputHtml = `<input type="${escAttr(field.type || 'text')}" id="${id}" name="${escAttr(field.name)}" placeholder="${escAttr(field.placeholder || '')}"${req}${ac}>`;
                }
                return `<label for="${id}">${escHtml(field.label || '')}</label>${inputHtml}`;
            }).join('\n');
        }

        let tsHtml = '';
        if (formCfg.turnstileSiteKey) {
            const tsTheme = computeTurnstileTheme(content.theme);
            tsHtml = `<div class="cf-turnstile" data-sitekey="${escAttr(formCfg.turnstileSiteKey)}" data-theme="${tsTheme}"></div>`;
        }

        const ogTags = [
            `<meta property="og:type" content="website">`,
            `<meta property="og:url" content="${escAttr(canonical)}">`,
            `<meta property="og:title" content="${escAttr(titleText)}">`,
            `<meta property="og:description" content="${escAttr(description)}">`,
        ].join('\n');

        const inlineScripts = `<script>window.__BUSINESS=${JSON.stringify(biz)};window.__FORM_CONFIG=${JSON.stringify(formCfg)};window.__IMAGES=${JSON.stringify(siteImages)};</script>`;

        const phoneSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

        const hero = content.hero || {};
        const contact = content.contact || {};
        const footer = content.footer || {};
        const submitLabel = escHtml(formCfg.submitLabel || 'Send Message');
        const ctaSecondary = escHtml(hero.ctaSecondaryText || 'Get A Quote');

        // ── Build complete HTML ───────────────────────────────────────────────

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(titleText)}</title>
    <meta name="description" content="${escAttr(description)}">
    ${ogTags}
    <link rel="stylesheet" href="template.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    ${inlineScripts}
    <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" defer></script>
    <script src="js/lucide.min.js" defer onload="lucide.createIcons()"></script>
    <script src="js/images.js" defer></script>
    <script src="js/main.js" defer></script>
    <style>body{opacity:0}body.content-loaded{opacity:1;transition:opacity .15s}</style>
    <noscript><style>body{opacity:1}</style></noscript>
</head>
<body class="content-loaded">

<a class="skip-nav" href="#main-content">Skip to main content</a>

<header id="main-header">
    <div class="header__inner">
        <a href="/" class="logo">${escHtml(biz.name || '')}</a>
        <a href="${escAttr(phoneHref)}" class="header__phone" aria-label="Call ${escAttr(phone)}">
            ${phoneSvg}
            <span aria-hidden="true">${escHtml(phone)}</span>
        </a>
        <nav id="main-nav" aria-label="Main navigation">
            <ul>${navHtml}</ul>
        </nav>
        <a href="#contact" class="btn btn--primary header__cta">${ctaSecondary}</a>
        <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav">
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
        </button>
    </div>
</header>

<main id="main-content">

<section id="hero" class="hero" data-section="hero">
    <div id="hero-images-slot" class="kb-container"></div>
    <div class="hero__overlay"></div>
    <div class="hero__content">
        <p class="eyebrow">${escHtml(hero.label || '')}</p>
        <h1>${escHtml(hero.title || '')}</h1>
        <p class="lead">${escHtml(hero.subtext || '')}</p>
        <a href="${escAttr(phoneHref)}" class="hero__phone">${escHtml(phone)}</a>
        <div class="hero__actions">
            <a class="btn btn--primary btn--lg" href="${escAttr(phoneHref)}">${escHtml(hero.ctaText || 'Call Now')}</a>
            <a class="btn btn--outline btn--lg" href="#contact">${ctaSecondary}</a>
        </div>
    </div>
</section>

<div id="sections-container">${sectionsHtml}</div>

<section id="contact" class="section section--alt" data-section="contact">
    <div class="container">
        <div class="section__header">
            <h2>${escHtml(contact.heading || 'Contact Us')}</h2>
            <p>${escHtml(contact.subheading || '')}</p>
        </div>
        <div class="contact-grid">
            <div class="contact-info">
                <div class="contact-info__item">
                    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    <div>
                        <strong>Phone</strong>
                        <a href="${escAttr(phoneHref)}">${escHtml(phone)}</a>
                    </div>
                </div>
                <div class="contact-info__item">
                    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    <div>${hoursHtml}</div>
                </div>
                <div class="contact-info__item">
                    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <div>
                        <strong>Service Area</strong>
                        <span>${escHtml(areasText)}</span>
                    </div>
                </div>
            </div>
            <form class="contact-form" action="/api/submit" method="POST">
                <input type="text" name="_hp" tabindex="-1" autocomplete="off" aria-hidden="true" class="honeypot">
                ${fieldsHtml}
                ${tsHtml}
                <button type="submit" class="btn btn--primary btn--full">${submitLabel}</button>
            </form>
        </div>
    </div>
</section>

</main>

<footer class="site-footer">
    <div class="container">
        <div class="footer-grid">
            <div class="footer__about">
                <h4>${escHtml(biz.name || '')}</h4>
                <p>${escHtml(footer.about || '')}</p>
                <a href="${escAttr(phoneHref)}" class="footer__phone">${escHtml(phone)}</a>
            </div>
            <div class="footer__services">
                <h4>Services</h4>
                <ul>${footerSvcHtml}</ul>
            </div>
            <div class="footer__areas">
                <h4>Service Area</h4>
                <ul>${areasListHtml}</ul>
            </div>
        </div>
        <div class="footer__bottom">
            <p>${escHtml(footer.copyright || '')}</p>
            <div class="footer__links">
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
            </div>
        </div>
    </div>
</footer>

</body>
</html>`;

        return new Response(html, {
            status: 200,
            headers: {
                'Content-Type': 'text/html;charset=UTF-8',
                'Cache-Control': 'no-store',
            },
        });

    } catch (e) {
        console.error('renderPage error:', e);
        return new Response('Internal server error', { status: 500 });
    }
}

async function renderLegalPage(env, url) {
    try {
        const contentRes = await env.ASSETS.fetch(new Request(new URL('/content.json', url).href));
        if (!contentRes.ok) return new Response('Not found', { status: 404 });
        const content = await contentRes.json();

        const type = url.pathname === '/terms' ? 'terms' : 'privacy';
        const biz = content.business || {};
        const nav = Array.isArray(content.nav) ? content.nav : [];
        const footer = content.footer || {};
        const legal = content.legal || {};
        const pageConfig = legal[type] || {};

        const phone = biz.phone || '';
        const phoneHref = biz.phoneHref || (phone ? `tel:${phone.replace(/\D/g, '')}` : '#');
        const ctaSecondary = escHtml((content.hero && content.hero.ctaSecondaryText) || 'Get A Quote');

        const defaults = type === 'terms' ? defaultTerms(biz) : defaultPrivacy(biz);
        const heading = pageConfig.heading || defaults.heading;
        const effectiveDate = pageConfig.effectiveDate || defaults.effectiveDate;
        const intro = pageConfig.intro || defaults.intro;
        const sections = (pageConfig.sections && pageConfig.sections.length > 0)
            ? pageConfig.sections
            : defaults.sections;

        const navHtml = nav.map(item =>
            `<li><a class="nav-link" href="${escAttr(item.href || '#')}">${escHtml(item.label || '')}</a></li>`
        ).join('');

        const sectionsHtml = sections.map(sec =>
            `<div class="legal-section">
                <h2>${escHtml(sec.heading || '')}</h2>
                ${(sec.body || '').split('\n\n').filter(p => p.trim()).map(p => `<p>${escHtml(p.trim())}</p>`).join('')}
            </div>`
        ).join('');

        const phoneSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.362 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.338 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;

        const footerSvcHtml = '';

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escHtml(heading)} | ${escHtml(biz.name || '')}</title>
    <link rel="stylesheet" href="/template.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script>window.__BUSINESS=${JSON.stringify(biz)};window.__FORM_CONFIG={};window.__IMAGES=[];</script>
    <script src="/js/lucide.min.js" defer onload="lucide.createIcons()"></script>
    <style>body{opacity:0}body.content-loaded{opacity:1;transition:opacity .15s}</style>
    <noscript><style>body{opacity:1}</style></noscript>
</head>
<body class="content-loaded">

<a class="skip-nav" href="#main-content">Skip to main content</a>

<header id="main-header">
    <div class="header__inner">
        <a href="/" class="logo">${escHtml(biz.name || '')}</a>
        <a href="${escAttr(phoneHref)}" class="header__phone" aria-label="Call ${escAttr(phone)}">
            ${phoneSvg}
            <span aria-hidden="true">${escHtml(phone)}</span>
        </a>
        <nav id="main-nav" aria-label="Main navigation">
            <ul>${navHtml}</ul>
        </nav>
        <a href="/#contact" class="btn btn--primary header__cta">${ctaSecondary}</a>
        <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav">
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
            <span aria-hidden="true"></span>
        </button>
    </div>
</header>

<main id="main-content" class="legal-page">
    <div class="container">
        <h1>${escHtml(heading)}</h1>
        ${effectiveDate ? `<p class="legal-page__date">Effective date: ${escHtml(effectiveDate)}</p>` : ''}
        ${intro ? `<p class="legal-page__intro">${escHtml(intro)}</p>` : ''}
        ${sectionsHtml}
    </div>
</main>

<footer class="site-footer">
    <div class="container">
        <div class="footer-grid">
            <div class="footer__about">
                <h4>${escHtml(biz.name || '')}</h4>
                <p>${escHtml(footer.about || '')}</p>
                <a href="${escAttr(phoneHref)}" class="footer__phone">${escHtml(phone)}</a>
            </div>
            <div class="footer__services"></div>
            <div class="footer__areas"></div>
        </div>
        <div class="footer__bottom">
            <p>${escHtml(footer.copyright || '')}</p>
            <div class="footer__links">
                <a href="/privacy">Privacy Policy</a>
                <a href="/terms">Terms of Service</a>
            </div>
        </div>
    </div>
</footer>

</body>
</html>`;

        return new Response(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' },
        });
    } catch (e) {
        console.error('renderLegalPage error:', e);
        return new Response('Internal server error', { status: 500 });
    }
}

function defaultTerms(biz) {
    const name = biz.name || 'this business';
    const email = biz.email || '';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const sections = [
        { heading: 'Acceptance of Terms', body: 'By accessing or using this website, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our website.' },
        { heading: 'Use of Website', body: 'You may use this website for lawful purposes only. You agree not to use this site in any way that is unlawful, harmful, fraudulent, or otherwise objectionable.' },
        { heading: 'Intellectual Property', body: `All content on this website, including text, graphics, logos, and images, is the property of ${name} and protected by applicable intellectual property laws. You may not reproduce or distribute any content without written permission.` },
        { heading: 'Disclaimer of Warranties', body: 'This website is provided "as is" without any warranties, express or implied. We do not guarantee that the site will be error-free, uninterrupted, or free of harmful components.' },
        { heading: 'Limitation of Liability', body: `${name} shall not be liable for any indirect, incidental, special, or consequential damages arising from your use of, or inability to use, this website.` },
        { heading: 'Changes to Terms', body: 'We reserve the right to update these Terms at any time. Continued use of the website after changes constitutes acceptance of the updated Terms.' },
    ];
    if (email) sections.push({ heading: 'Contact', body: `If you have questions about these Terms of Service, please contact us at ${email}.` });
    return { heading: 'Terms of Service', effectiveDate: date, intro: 'Please read these Terms of Service carefully before using our website.', sections };
}

function defaultPrivacy(biz) {
    const name = biz.name || 'we';
    const email = biz.email || '';
    const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const sections = [
        { heading: 'Information We Collect', body: 'When you submit our contact form, we collect the information you provide, including your name, email address, phone number, and message. We do not collect information automatically beyond standard server logs.' },
        { heading: 'How We Use Your Information', body: `We use the information you provide solely to respond to your inquiry and communicate with you about our services. ${name} does not sell, rent, or share your personal information with third parties for marketing purposes.` },
        { heading: 'Data Retention', body: 'We retain your contact information only as long as necessary to fulfill your request or as required by law. You may request deletion of your information at any time.' },
        { heading: 'Data Security', body: 'We take reasonable precautions to protect your information. However, no method of transmission over the internet is completely secure, and we cannot guarantee absolute security.' },
        { heading: 'Cookies', body: 'This website may use cookies to improve your browsing experience. Cookies are small text files stored on your device. You can disable cookies through your browser settings, though some features may not function correctly.' },
        { heading: 'Third-Party Services', body: 'This website uses Cloudflare for security and performance services. These services may process technical data such as IP addresses in accordance with their own privacy policies.' },
        { heading: 'Changes to This Policy', body: 'We may update this Privacy Policy from time to time. We will indicate the effective date of the latest version at the top of this page.' },
    ];
    if (email) sections.push({ heading: 'Contact', body: `If you have questions about this Privacy Policy or wish to request deletion of your data, please contact us at ${email}.` });
    return { heading: 'Privacy Policy', effectiveDate: date, intro: 'Your privacy is important to us. This policy explains what information we collect and how we use it.', sections };
}

function renderSection(sec, idx) {
    const isTestimonial = sec.items && sec.items.length > 0 && sec.items[0].quote !== undefined;
    const useAlt = idx % 2 === 1;
    const idAttr = sec.id ? ` id="${escAttr(sec.id)}"` : '';

    let headerHtml = '';
    if (sec.label)      headerHtml += `<p class="section__label">${escHtml(sec.label)}</p>`;
    if (sec.heading)    headerHtml += `<h2 class="section-heading">${escHtml(sec.heading)}</h2>`;
    if (sec.subheading) headerHtml += `<p class="section__subheading">${escHtml(sec.subheading)}</p>`;

    let gridHtml = '';
    if (sec.items && sec.items.length > 0) {
        if (isTestimonial) {
            const cards = sec.items.map(item => {
                const starCount = item.stars || 5;
                const stars = Array(starCount).fill(
                    `<svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="var(--color-star)"><path d="M10 1l2.5 5.5H18l-4.5 3.5 1.5 5.5L10 13l-5 2.5 1.5-5.5L2 6.5h5.5z"/></svg>`
                ).join('');
                return `<div class="testimonial-card"><div class="testimonial-card__stars" aria-label="${starCount} out of 5 stars">${stars}</div><blockquote class="testimonial-card__quote">${escHtml(item.quote || '')}</blockquote><div class="testimonial-card__author"><strong>${escHtml(item.author || '')}</strong><span>${escHtml(item.role || '')}</span></div></div>`;
            }).join('');
            gridHtml = `<div class="testimonials-grid">${cards}</div>`;
        } else {
            const cards = sec.items.map(item => {
                let inner = '';
                if (item.icon)   inner += `<div class="card__icon"><i data-lucide="${escAttr(item.icon)}" width="40" height="40"></i></div>`;
                if (item.number) inner += `<div class="card__number">${escHtml(String(item.number))}</div>`;
                if (item.title)  inner += `<h3 class="card__title">${escHtml(item.title)}</h3>`;
                if (item.text)   inner += `<p class="card__text">${escHtml(item.text)}</p>`;
                return `<div class="card">${inner}</div>`;
            }).join('');
            gridHtml = `<div class="cards-grid">${cards}</div>`;
        }
    }

    return `<section${idAttr} class="section section-visible${useAlt ? ' section--alt' : ''}"><div class="container"><div class="section__header">${headerHtml}</div>${gridHtml}</div></section>`;
}

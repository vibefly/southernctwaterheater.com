export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/api/submit') {
            return handleSubmit(request, env);
        }

        if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
            return renderPage(request, env, url);
        }

        return env.ASSETS.fetch(request);
    }
};

async function renderPage(request, env, url) {
    try {
        const [htmlRes, contentRes] = await Promise.all([
            env.ASSETS.fetch(new Request(request.url)),
            env.ASSETS.fetch(new Request(new URL('/content.json', url).href)),
        ]);

        if (!htmlRes.ok || !contentRes.ok) return env.ASSETS.fetch(request);

        const content = await contentRes.json();
        const biz = content.business || {};
        const formCfg = content.form || {};
        if (!formCfg.thankYouSub && formCfg.thankYouSubtext) formCfg.thankYouSub = formCfg.thankYouSubtext;
        if (!formCfg.thankYouSubtext && formCfg.thankYouSub) formCfg.thankYouSubtext = formCfg.thankYouSub;

        const sections = (content.pages && content.pages.home && content.pages.home.sections) || [];
        const nav = Array.isArray(content.nav) ? content.nav : [];
        const phone = biz.phone || '';
        const phoneHref = biz.phoneHref || (phone ? `tel:${phone.replace(/\D/g, '')}` : '#');

        function resolve(path) {
            return path.split('.').reduce((o, k) => (o != null ? o[k] : undefined), content);
        }

        /* Pre-build HTML strings */
        const navHtml = nav.map(item =>
            `<li><a class="nav-link" href="${escAttr(item.href || '#')}">${escHtml(item.label || '')}</a></li>`
        ).join('');

        const sectionsHtml = sections.map((sec, idx) => renderSection(sec, idx)).join('\n');

        let fieldsHtml = '';
        if (formCfg.fields) {
            fieldsHtml = formCfg.fields.map(field => {
                const id = `contact-${field.name}`;
                const req = field.required ? ' required' : '';
                let inputHtml;
                if (field.type === 'textarea') {
                    inputHtml = `<textarea id="${id}" name="${escAttr(field.name)}" rows="${field.rows || 4}" placeholder="${escAttr(field.placeholder || '')}"${req}></textarea>`;
                } else if (field.type === 'select') {
                    const opts = (field.options || []).map(o =>
                        `<option value="${escAttr(String(o.value))}">${escHtml(String(o.label))}</option>`
                    ).join('');
                    inputHtml = `<select id="${id}" name="${escAttr(field.name)}"${req}><option value="">${escHtml(field.placeholder || 'Select\u2026')}</option>${opts}</select>`;
                } else {
                    inputHtml = `<input type="${escAttr(field.type || 'text')}" id="${id}" name="${escAttr(field.name)}" placeholder="${escAttr(field.placeholder || '')}"${req}>`;
                }
                return `<label for="${id}">${escHtml(field.label || '')}</label>${inputHtml}`;
            }).join('\n');
        }

        let tsHtml = '';
        if (formCfg.turnstileSiteKey) {
            const tsTheme = computeTurnstileTheme(content.theme);
            tsHtml = `<div id="cf-turnstile" data-sitekey="${escAttr(formCfg.turnstileSiteKey)}" data-theme="${tsTheme}"></div>`;
        }

        const themeCss = buildThemeCss(content.theme);
        const titleText = content.meta && content.meta.title ? content.meta.title : (biz.name || '');
        const titleAttr = escAttr(titleText);
        const description = escAttr((content.meta && content.meta.description) || '');
        const canonical = escAttr(url.origin + url.pathname);
        const ogTags = [
            `<meta property="og:type" content="website">`,
            `<meta property="og:url" content="${canonical}">`,
            `<meta property="og:title" content="${titleAttr}">`,
            `<meta property="og:description" content="${description}">`,
        ].join('\n');
        const inlineScripts = `<script>window.__BUSINESS=${JSON.stringify(biz)};window.__FORM_CONFIG=${JSON.stringify(formCfg)};</script>`;

        const serviceAreas = (content.contact && content.contact.serviceAreas) || [];
        const areasText = serviceAreas.join(', ');
        const areasListHtml = serviceAreas.map(a => `<li>${escHtml(a)}</li>`).join('');

        const hours = (content.contact && content.contact.hours) || [];
        const hoursHtml = `<strong>Hours</strong>${hours.map(h => `<span>${escHtml(h)}</span>`).join('')}`;

        const footerSvc = sections.find(s => s.items && s.items.length > 0 && !s.items[0].quote);
        const footerSvcHtml = footerSvc ? footerSvc.items.map(item =>
            `<li><a href="#${escAttr(footerSvc.id || 'services')}">${escHtml(item.title || '')}</a></li>`
        ).join('') : '';

        const rewriter = new HTMLRewriter()
            .on('title', {
                element(el) { el.setInnerContent(escHtml(titleText)); }
            })
            .on('meta[name="description"]', {
                element(el) {
                    el.setAttribute('content', description);
                    el.after(ogTags, { html: true });
                }
            })
            .on('head', {
                element(el) {
                    if (themeCss) el.append(`<style>:root{${themeCss}}</style>`, { html: true });
                    el.append(inlineScripts, { html: true });
                }
            })
            .on('body', {
                element(el) {
                    const cls = el.getAttribute('class') || '';
                    el.setAttribute('class', (cls + ' content-loaded').trim());
                }
            })
            .on('[data-content]', {
                element(el) {
                    const val = resolve(el.getAttribute('data-content'));
                    if (val != null) el.setInnerContent(String(val));
                }
            })
            .on('[data-content-attr-href]', {
                element(el) {
                    const val = resolve(el.getAttribute('data-content-attr-href'));
                    if (val) el.setAttribute('href', String(val));
                }
            })
            .on('[data-content-nav]', {
                element(el) { el.setInnerContent(navHtml, { html: true }); }
            })
            .on('[data-content-phone]', {
                element(el) {
                    el.setInnerContent(phone);
                    if (el.tagName === 'a') el.setAttribute('href', phoneHref);
                }
            })
            .on('[data-phone-href]', {
                element(el) {
                    if (el.tagName === 'a') el.setAttribute('href', phoneHref);
                }
            })
            .on('[data-content-email]', {
                element(el) {
                    el.setInnerContent(biz.email || '');
                    if (el.tagName === 'a' && biz.email) el.setAttribute('href', `mailto:${biz.email}`);
                }
            })
            .on('[data-content-list="contact.hours"]', {
                element(el) { el.setInnerContent(hoursHtml, { html: true }); }
            })
            .on('[data-content-areas-text]', {
                element(el) { el.setInnerContent(areasText); }
            })
            .on('[data-content-areas-list]', {
                element(el) { el.setInnerContent(areasListHtml, { html: true }); }
            })
            .on('#sections-container', {
                element(el) { el.setInnerContent(sectionsHtml, { html: true }); }
            })
            .on('.contact-form', {
                comments(comment) {
                    if (comment.text.includes('Fields injected')) {
                        comment.replace(fieldsHtml + (tsHtml ? '\n' + tsHtml : ''), { html: true });
                    }
                }
            })
            .on('button[type="submit"]', {
                element(el) {
                    if (formCfg.submitLabel) el.setInnerContent(formCfg.submitLabel);
                }
            })
            .on('[data-content-footer-services]', {
                element(el) { el.setInnerContent(footerSvcHtml, { html: true }); }
            })
            .on('[data-content-footer-credit]', {
                element(el) {
                    if (content.footer && content.footer.creditName) el.setInnerContent(content.footer.creditName);
                    if (content.footer && content.footer.creditUrl) el.setAttribute('href', content.footer.creditUrl);
                }
            })
            .on('[data-content-copyright]', {
                element(el) {
                    if (content.footer && content.footer.copyright) el.setInnerContent(content.footer.copyright);
                }
            });

        return rewriter.transform(new Response(htmlRes.body, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        }));

    } catch {
        return env.ASSETS.fetch(request);
    }
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
                const stars = Array(item.stars || 5).fill(
                    `<svg width="20" height="20" viewBox="0 0 20 20" fill="var(--color-star)"><path d="M10 1l2.5 5.5H18l-4.5 3.5 1.5 5.5L10 13l-5 2.5 1.5-5.5L2 6.5h5.5z"/></svg>`
                ).join('');
                return `<div class="testimonial-card"><div class="testimonial-card__stars">${stars}</div><blockquote class="testimonial-card__quote">${escHtml(item.quote || '')}</blockquote><div class="testimonial-card__author"><strong>${escHtml(item.author || '')}</strong><span>${escHtml(item.role || '')}</span></div></div>`;
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

function buildThemeCss(theme) {
    if (!theme) return '';
    const t = theme;
    const vars = [];
    if (t.bg)             { vars.push(`--color-bg:${t.bg}`, `--color-dark-bg:${t.bg}`); }
    if (t.bgAlt)          { vars.push(`--color-bg-alt:${t.bgAlt}`, `--color-light-bg:${t.bgAlt}`); }
    if (t.bgDark)           vars.push(`--color-bg-dark:${t.bgDark}`);
    if (t.accentPrimary)  { vars.push(`--color-primary:${t.accentPrimary}`, `--color-accent-neon:${t.accentPrimary}`); }
    if (t.accentSecondary){ vars.push(`--color-primary-dark:${t.accentSecondary}`, `--color-accent-blue:${t.accentSecondary}`); }
    if (t.accentLight)      vars.push(`--color-primary-light:${t.accentLight}`);
    if (t.textPrimary)    { vars.push(`--color-text:${t.textPrimary}`, `--color-text-primary:${t.textPrimary}`); }
    if (t.textSecondary)  { vars.push(`--color-text-light:${t.textSecondary}`, `--color-text-secondary:${t.textSecondary}`); }
    if (t.heroStart)        vars.push(`--color-hero-start:${t.heroStart}`);
    if (t.heroMid)          vars.push(`--color-hero-mid:${t.heroMid}`);
    if (t.heroEnd)          vars.push(`--color-hero-end:${t.heroEnd}`);
    if (t.star)             vars.push(`--color-star:${t.star}`);
    if (t.borderCard)       vars.push(`--color-border-card:${t.borderCard}`);
    if (t.borderCardHover)  vars.push(`--color-border-card-hover:${t.borderCardHover}`);
    return vars.join(';');
}

function computeTurnstileTheme(theme) {
    if (!theme) return 'light';
    const hex = ((theme.bg || theme.bgDark) || '#ffffff').replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) / 255;
    const g = parseInt(hex.substring(2, 4), 16) / 255;
    const b = parseInt(hex.substring(4, 6), 16) / 255;
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.5 ? 'light' : 'dark';
}

function escHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

async function handleSubmit(request, env) {
    try {
        const formData = await request.formData();

        const systemFields = new Set(['_gotcha', 'cf-turnstile-response', 'first_name', 'last_name']);
        const firstName = (formData.get('first_name') || '').trim();
        const lastName  = (formData.get('last_name')  || '').trim();
        const name = (formData.get('name') || [firstName, lastName].filter(Boolean).join(' ')).trim();

        const fields = [];
        if (name) fields.push({ name: 'Name', value: name });
        for (const [key, val] of formData.entries()) {
            if (!systemFields.has(key) && key !== 'name') {
                fields.push({ name: key.charAt(0).toUpperCase() + key.slice(1), value: val.toString().trim() });
            }
        }

        if (env.TURNSTILE_SECRET_KEY) {
            const token = formData.get('cf-turnstile-response');
            const valid = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
            if (!valid) return jsonError('CAPTCHA verification failed.', 400);
        }

        const content = await fetchContent(env, request);
        const ownerEmail = (content && content.business && content.business.email) || env.OWNER_EMAIL;

        if (!ownerEmail) {
            console.error('No owner email configured');
            return jsonError('Server configuration error.', 500);
        }

        const fromEmail = env.FROM_EMAIL || 'noreply@vibefly.ai';
        const site = fromEmail.split('@')[1] || '';

        const notifLines = fields.map(f => `${f.name}: ${f.value || '(not provided)'}`);
        await sendEmail(env, {
            from:    fromEmail,
            to:      ownerEmail,
            subject: `${site ? '[' + site + '] ' : ''}New inquiry${name ? ' from ' + name : ''}`,
            body:    notifLines.join('\n'),
        });

        return jsonOk();

    } catch (err) {
        console.error('Form submission error:', err);
        return jsonError('Server error. Please try again.', 500);
    }
}

async function fetchContent(env, request) {
    try {
        const url = new URL('/content.json', new URL(request.url).origin);
        const res = await env.ASSETS.fetch(new Request(url.href));
        return await res.json();
    } catch {
        return null;
    }
}

async function verifyTurnstile(token, secretKey) {
    if (!token) return false;
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(token)}`,
    });
    const data = await res.json();
    return data.success === true;
}

async function sendEmail(env, { from, to, subject, body }) {
    const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], subject, text: body }),
    });

    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Resend ${res.status}: ${text}`);
    }
}

function jsonOk() {
    return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
    });
}

function jsonError(message, status) {
    return new Response(JSON.stringify({ ok: false, error: message }), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });
}

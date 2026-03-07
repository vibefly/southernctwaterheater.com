/* content-loader.js — Universal loader for all vibefly templates */

(async function () {
    'use strict';

    /* SSR fast path: Worker has already rendered all content into HTML */
    if (window.__BUSINESS) {
        var formCfg = window.__FORM_CONFIG || {};
        if (formCfg.turnstileSiteKey) {
            var tsContainer = document.getElementById('cf-turnstile');
            var tsTheme = (tsContainer && tsContainer.dataset.theme) || 'light';
            function renderTurnstile() {
                if (window.turnstile) {
                    turnstile.render('#cf-turnstile', { sitekey: formCfg.turnstileSiteKey, theme: tsTheme });
                } else {
                    setTimeout(renderTurnstile, 50);
                }
            }
            renderTurnstile();
        }
        if (window.lucide) try { lucide.createIcons(); } catch (e) {}
        document.body.classList.add('content-loaded');
        return;
    }

    /* Non-SSR fallback (local dev / no Worker) — temporarily disabled */
    return;

    var biz = data.business || {};

    /* Globals for main.js */
    window.__BUSINESS = biz;
    var formCfg = data.form || {};
    /* Compatibility: one-pager uses thankYouSub, vibefly-landing uses thankYouSubtext */
    if (!formCfg.thankYouSub && formCfg.thankYouSubtext) formCfg.thankYouSub = formCfg.thankYouSubtext;
    if (!formCfg.thankYouSubtext && formCfg.thankYouSub) formCfg.thankYouSubtext = formCfg.thankYouSub;
    window.__FORM_CONFIG = formCfg;

    /* Theme — map universal keys to all template CSS var names */
    if (data.theme) {
        var root = document.documentElement.style;
        var t = data.theme;
        /* Background */
        if (t.bg) {
            root.setProperty('--color-bg', t.bg);
            root.setProperty('--color-dark-bg', t.bg);
        }
        if (t.bgAlt) {
            root.setProperty('--color-bg-alt', t.bgAlt);
            root.setProperty('--color-light-bg', t.bgAlt);
        }
        if (t.bgDark) root.setProperty('--color-bg-dark', t.bgDark);
        /* Accent */
        if (t.accentPrimary) {
            root.setProperty('--color-primary', t.accentPrimary);
            root.setProperty('--color-accent-neon', t.accentPrimary);
        }
        if (t.accentSecondary) {
            root.setProperty('--color-primary-dark', t.accentSecondary);
            root.setProperty('--color-accent-blue', t.accentSecondary);
        }
        if (t.accentLight) root.setProperty('--color-primary-light', t.accentLight);
        /* Text */
        if (t.textPrimary) {
            root.setProperty('--color-text', t.textPrimary);
            root.setProperty('--color-text-primary', t.textPrimary);
        }
        if (t.textSecondary) {
            root.setProperty('--color-text-light', t.textSecondary);
            root.setProperty('--color-text-secondary', t.textSecondary);
        }
        /* One-pager hero gradient */
        if (t.heroStart) root.setProperty('--color-hero-start', t.heroStart);
        if (t.heroMid)   root.setProperty('--color-hero-mid', t.heroMid);
        if (t.heroEnd)   root.setProperty('--color-hero-end', t.heroEnd);
        if (t.star)      root.setProperty('--color-star', t.star);
        /* vibefly-landing card borders */
        if (t.borderCard)      root.setProperty('--color-border-card', t.borderCard);
        if (t.borderCardHover) root.setProperty('--color-border-card-hover', t.borderCardHover);
    }

    /* Meta */
    if (data.meta) {
        if (data.meta.title) document.title = data.meta.title;
        var desc = document.querySelector('meta[name="description"]');
        if (desc && data.meta.description) desc.setAttribute('content', data.meta.description);
    }

    /* Resolve dotted path like "hero.title" */
    function resolve(path) {
        return path.split('.').reduce(function (o, k) { return o && o[k]; }, data);
    }

    /* Simple text bindings */
    document.querySelectorAll('[data-content]').forEach(function (el) {
        var val = resolve(el.dataset.content);
        if (val !== undefined && val !== null) el.textContent = val;
    });

    /* Attribute bindings */
    document.querySelectorAll('[data-content-attr-href]').forEach(function (el) {
        var val = resolve(el.dataset.contentAttrHref);
        if (val) el.setAttribute('href', val);
    });

    /* Nav links */
    var navList = document.querySelector('[data-content-nav]');
    if (navList && data.nav && Array.isArray(data.nav)) {
        navList.innerHTML = '';
        data.nav.forEach(function (item) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.className = 'nav-link';
            a.href = item.href;
            a.textContent = item.label;
            li.appendChild(a);
            navList.appendChild(li);
        });
    }

    /* Phone links */
    document.querySelectorAll('[data-content-phone]').forEach(function (el) {
        el.textContent = biz.phone || '';
        if (el.tagName === 'A') el.href = biz.phoneHref || '#';
    });

    /* Email links */
    document.querySelectorAll('[data-content-email]').forEach(function (el) {
        el.textContent = biz.email || '';
        if (el.tagName === 'A') el.href = 'mailto:' + (biz.email || '');
    });

    /* Phone href only */
    document.querySelectorAll('[data-phone-href]').forEach(function (el) {
        if (el.tagName === 'A' && biz.phoneHref) el.href = biz.phoneHref;
    });

    /* Hours list */
    var hoursEl = document.querySelector('[data-content-list="contact.hours"]');
    if (hoursEl && data.contact && data.contact.hours) {
        Array.from(hoursEl.querySelectorAll('span')).forEach(function (s) { s.remove(); });
        data.contact.hours.forEach(function (h) {
            var span = document.createElement('span');
            span.textContent = h;
            hoursEl.appendChild(span);
        });
    }

    /* Service areas — text */
    var areasText = document.querySelector('[data-content-areas-text]');
    if (areasText && data.contact && data.contact.serviceAreas) {
        areasText.textContent = data.contact.serviceAreas.join(', ');
    }

    /* Service areas — list */
    var areasUl = document.querySelector('[data-content-areas-list]');
    if (areasUl && data.contact && data.contact.serviceAreas) {
        areasUl.innerHTML = '';
        data.contact.serviceAreas.forEach(function (area) {
            var li = document.createElement('li');
            li.textContent = area;
            areasUl.appendChild(li);
        });
    }

    /* ── Dynamic sections — render pages.home.sections into #sections-container ── */
    var sectionsContainer = document.getElementById('sections-container');
    var sections = (data.pages && data.pages.home && data.pages.home.sections) || [];
    if (sectionsContainer && sections.length > 0) {
        sections.forEach(function (sec, idx) {
            var isTestimonial = sec.items && sec.items.length > 0 && sec.items[0].quote !== undefined;
            var useAlt = idx % 2 === 1;

            var section = document.createElement('section');
            /* section-visible added immediately: main.js IntersectionObserver runs before
               content-loader finishes async work so it can't observe dynamic sections */
            section.className = 'section section-visible' + (useAlt ? ' section--alt' : '');
            if (sec.id) section.id = sec.id;

            var container = document.createElement('div');
            container.className = 'container';

            /* Header */
            var header = document.createElement('div');
            header.className = 'section__header';
            if (sec.label) {
                var labelEl = document.createElement('p');
                labelEl.className = 'section__label';
                labelEl.textContent = sec.label;
                header.appendChild(labelEl);
            }
            if (sec.heading) {
                var h2 = document.createElement('h2');
                h2.className = 'section-heading';
                h2.textContent = sec.heading;
                header.appendChild(h2);
            }
            if (sec.subheading) {
                var subEl = document.createElement('p');
                subEl.className = 'section__subheading';
                subEl.textContent = sec.subheading;
                header.appendChild(subEl);
            }
            container.appendChild(header);

            /* Items grid */
            if (sec.items && sec.items.length > 0) {
                var grid = document.createElement('div');
                if (isTestimonial) {
                    grid.className = 'testimonials-grid';
                    sec.items.forEach(function (item) {
                        var card = document.createElement('div');
                        card.className = 'testimonial-card';

                        var starsEl = document.createElement('div');
                        starsEl.className = 'testimonial-card__stars';
                        var starCount = item.stars || 5;
                        for (var s = 0; s < starCount; s++) {
                            var star = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                            star.setAttribute('width', '20');
                            star.setAttribute('height', '20');
                            star.setAttribute('viewBox', '0 0 20 20');
                            star.setAttribute('fill', 'var(--color-star)');
                            star.innerHTML = '<path d="M10 1l2.5 5.5H18l-4.5 3.5 1.5 5.5L10 13l-5 2.5 1.5-5.5L2 6.5h5.5z"/>';
                            starsEl.appendChild(star);
                        }
                        card.appendChild(starsEl);

                        var quote = document.createElement('blockquote');
                        quote.className = 'testimonial-card__quote';
                        quote.textContent = item.quote;
                        card.appendChild(quote);

                        var authorDiv = document.createElement('div');
                        authorDiv.className = 'testimonial-card__author';
                        var strong = document.createElement('strong');
                        strong.textContent = item.author || '';
                        var roleEl = document.createElement('span');
                        roleEl.textContent = item.role || '';
                        authorDiv.appendChild(strong);
                        authorDiv.appendChild(roleEl);
                        card.appendChild(authorDiv);

                        grid.appendChild(card);
                    });
                } else {
                    grid.className = 'cards-grid';
                    sec.items.forEach(function (item) {
                        var card = document.createElement('div');
                        card.className = 'card';

                        if (item.icon) {
                            var iconDiv = document.createElement('div');
                            iconDiv.className = 'card__icon';
                            var i = document.createElement('i');
                            i.setAttribute('data-lucide', item.icon);
                            i.setAttribute('width', '40');
                            i.setAttribute('height', '40');
                            iconDiv.appendChild(i);
                            card.appendChild(iconDiv);
                        }
                        if (item.number) {
                            var numEl = document.createElement('div');
                            numEl.className = 'card__number';
                            numEl.textContent = item.number;
                            card.appendChild(numEl);
                        }
                        if (item.title) {
                            var titleEl = document.createElement('h3');
                            titleEl.className = 'card__title';
                            titleEl.textContent = item.title;
                            card.appendChild(titleEl);
                        }
                        if (item.text) {
                            var textEl = document.createElement('p');
                            textEl.className = 'card__text';
                            textEl.textContent = item.text;
                            card.appendChild(textEl);
                        }
                        grid.appendChild(card);
                    });
                }
                container.appendChild(grid);
            }

            section.appendChild(container);
            sectionsContainer.appendChild(section);
        });
    }

    /* Footer services — from first non-testimonial section */
    var footerSvc = document.querySelector('[data-content-footer-services]');
    if (footerSvc && sections.length > 0) {
        var firstCardSec = null;
        for (var k = 0; k < sections.length; k++) {
            if (sections[k].items && sections[k].items.length > 0 && !sections[k].items[0].quote) {
                firstCardSec = sections[k];
                break;
            }
        }
        if (firstCardSec) {
            footerSvc.innerHTML = '';
            firstCardSec.items.forEach(function (item) {
                var li = document.createElement('li');
                var a = document.createElement('a');
                a.href = '#' + (firstCardSec.id || 'services');
                a.textContent = item.title || '';
                li.appendChild(a);
                footerSvc.appendChild(li);
            });
        }
    }

    /* Form fields injection */
    var formEl = document.querySelector('.contact-form');
    var submitBtn = formEl ? formEl.querySelector('button[type="submit"]') : null;
    if (formEl && submitBtn && formCfg.fields) {
        formCfg.fields.forEach(function (field) {
            var id = 'contact-' + field.name;

            var label = document.createElement('label');
            label.setAttribute('for', id);
            label.textContent = field.label;
            formEl.insertBefore(label, submitBtn);

            var input;
            if (field.type === 'textarea') {
                input = document.createElement('textarea');
                input.rows = field.rows || 4;
                if (field.placeholder) input.placeholder = field.placeholder;
            } else if (field.type === 'select') {
                input = document.createElement('select');
                var ph = document.createElement('option');
                ph.value = '';
                ph.textContent = field.placeholder || 'Select\u2026';
                input.appendChild(ph);
                (field.options || []).forEach(function (opt) {
                    var o = document.createElement('option');
                    o.value = opt.value;
                    o.textContent = opt.label;
                    input.appendChild(o);
                });
            } else {
                input = document.createElement('input');
                input.type = field.type || 'text';
                if (field.placeholder) input.placeholder = field.placeholder;
            }
            input.id = id;
            input.name = field.name;
            if (field.required) input.required = true;
            formEl.insertBefore(input, submitBtn);
        });

        if (formCfg.submitLabel) submitBtn.textContent = formCfg.submitLabel;

        /* Turnstile */
        if (formCfg.turnstileSiteKey) {
            var tsContainer = document.createElement('div');
            tsContainer.id = 'cf-turnstile';
            formEl.insertBefore(tsContainer, submitBtn);
            var tsTheme = 'light';
            if (data.theme && (data.theme.bgDark || data.theme.bg)) {
                var hex = (data.theme.bg || data.theme.bgDark).replace('#', '');
                var r = parseInt(hex.substring(0, 2), 16) / 255;
                var g = parseInt(hex.substring(2, 4), 16) / 255;
                var b = parseInt(hex.substring(4, 6), 16) / 255;
                tsTheme = (0.2126 * r + 0.7152 * g + 0.0722 * b) > 0.5 ? 'light' : 'dark';
            }
            function renderTurnstile() {
                if (window.turnstile) {
                    turnstile.render('#cf-turnstile', { sitekey: formCfg.turnstileSiteKey, theme: tsTheme });
                } else {
                    setTimeout(renderTurnstile, 50);
                }
            }
            renderTurnstile();
        }
    }

    /* Footer credit link */
    var creditLink = document.querySelector('[data-content-footer-credit]');
    if (creditLink && data.footer) {
        if (data.footer.creditName) creditLink.textContent = data.footer.creditName;
        if (data.footer.creditUrl) creditLink.href = data.footer.creditUrl;
    }

    /* Footer copyright */
    var copyrightEl = document.querySelector('[data-content-copyright]');
    if (copyrightEl && data.footer && data.footer.copyright) {
        copyrightEl.textContent = data.footer.copyright;
    }

    /* Render Lucide icons */
    if (window.lucide) {
        try { lucide.createIcons(); } catch (e) { console.warn('Lucide render error:', e); }
    }

    /* Reveal page */
    document.body.classList.add('content-loaded');
})();

/* Safety fallback — show page even if content.json fails */
setTimeout(function () { document.body.classList.add('content-loaded'); }, 800);

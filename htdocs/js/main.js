/* === Service Business Template — Main JS === */

(function () {
    'use strict';

    /* --- Config from content-loader (set before this script runs) --- */
    var formCfg = window.__FORM_CONFIG || {};
    var biz = window.__BUSINESS || {};

    /* --- Mobile Nav Toggle --- */
    var navToggle = document.querySelector('.nav-toggle');
    var mainNav = document.getElementById('main-nav');

    if (navToggle && mainNav) {
        navToggle.addEventListener('click', function () {
            var isOpen = mainNav.classList.toggle('is-open');
            navToggle.classList.toggle('is-active', isOpen);
            navToggle.setAttribute('aria-expanded', isOpen);
        });

        mainNav.querySelectorAll('a').forEach(function (link) {
            link.addEventListener('click', function () {
                mainNav.classList.remove('is-open');
                navToggle.classList.remove('is-active');
                navToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* --- Smooth Scroll for anchor links --- */
    document.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.addEventListener('click', function (e) {
            var target = document.querySelector(link.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            target.scrollIntoView({ behavior: 'smooth' });
        });
    });

    /* --- AJAX Form Handler (4-phase) --- */
    var form = document.querySelector('.contact-form');
    var contactSection = document.getElementById('contact');
    if (!form || !contactSection) return;

    var formAction = form.getAttribute('action');
    var sectionHeader = contactSection.querySelector('.section__header');
    var headerH2 = sectionHeader ? sectionHeader.querySelector('h2') : null;
    var headerP = sectionHeader ? sectionHeader.querySelector('p:not(.eyebrow)') : null;

    var statusMessages = formCfg.statusMessages || [
        'Sending your message\u2026',
        'Almost there\u2026'
    ];

    function sleep(ms) {
        return new Promise(function (r) { setTimeout(r, ms); });
    }

    function animateBar(el, targetPercent, duration) {
        var start = performance.now();
        var tick = function (now) {
            var elapsed = now - start;
            var progress = Math.min(elapsed / duration, 1);
            var eased = 1 - Math.pow(1 - progress, 2);
            el.style.width = (eased * targetPercent) + '%';
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    function showThankYou() {
        contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

        /* Crossfade headline */
        var tyHeading = formCfg.thankYouHeading || 'Thank You';
        if (headerH2) {
            headerH2.style.transition = 'opacity 0.3s ease';
            headerH2.style.opacity = '0';
            setTimeout(function () {
                headerH2.textContent = tyHeading;
                headerH2.style.opacity = '1';
            }, 320);
        }

        /* Build thank-you content */
        var tyMsg = formCfg.thankYouMessage || 'We received your message and will be in touch shortly.';
        var tySub = formCfg.thankYouSub || 'For immediate assistance, call us at';
        var phoneText = biz.phone || '';
        var phoneHref = biz.phoneHref || '#';

        var ty = document.createElement('div');
        ty.className = 'form-thank-you';
        ty.innerHTML =
            '<p>' + tyMsg + '</p>' +
            '<p class="thank-you-sub">' + tySub + ' <a href="' + phoneHref + '">' + phoneText + '</a>.</p>';

        if (headerP) headerP.style.display = 'none';
        contactSection.querySelector('.contact-grid').appendChild(ty);
        form.remove();

        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                ty.classList.add('is-visible');
            });
        });
    }

    async function beginSending(formData) {
        /* Phase 2: Show progress UI */
        var sending = document.createElement('div');
        sending.className = 'contact-sending';
        sending.innerHTML =
            '<div class="sending-status"></div>' +
            '<div class="sending-progress-track">' +
                '<div class="sending-progress-bar"></div>' +
            '</div>';

        var grid = contactSection.querySelector('.contact-grid');
        grid.appendChild(sending);

        var statusEl = sending.querySelector('.sending-status');
        var barEl = sending.querySelector('.sending-progress-bar');

        /* Trigger entrance */
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                sending.classList.add('is-visible');
                sending.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
        });

        /* Cycle status messages */
        var msgIdx = 0;
        statusEl.textContent = statusMessages[msgIdx++];

        var stopped = false;
        var msgTimer = setInterval(function () {
            if (stopped) return;
            statusEl.classList.add('is-swapping');
            setTimeout(function () {
                statusEl.textContent = statusMessages[msgIdx % statusMessages.length];
                msgIdx++;
                statusEl.classList.remove('is-swapping');
            }, 200);
        }, 1800);

        /* Animate bar to ~75% over 5s */
        animateBar(barEl, 75, 5000);

        /* Fire the actual fetch */
        var ok = false;
        try {
            var res = await fetch(formAction, {
                method: 'POST',
                body: formData,
                headers: { 'Accept': 'application/json' }
            });
            ok = res.ok;
        } catch (e) {
            ok = false;
        }

        stopped = true;
        clearInterval(msgTimer);

        if (ok) {
            /* Phase 3: Complete bar & show delivered */
            barEl.style.transition = 'width 0.5s ease-out';
            barEl.style.width = '100%';

            var deliveredMsg = formCfg.deliveredMessage || 'Message delivered!';
            statusEl.classList.add('is-swapping');
            await sleep(180);
            statusEl.textContent = deliveredMsg;
            statusEl.classList.remove('is-swapping');

            await sleep(1400);

            /* Phase 4: Transition to thank-you */
            sending.classList.remove('is-visible');
            await sleep(450);
            sending.remove();
            showThankYou();
        } else {
            /* Error: show form again for retry */
            sending.classList.remove('is-visible');
            await sleep(450);
            sending.remove();

            form.classList.remove('is-hidden', 'is-fading');
            if (headerP) {
                headerP.style.opacity = '1';
            }
            var btn = form.querySelector('button[type="submit"]');
            if (btn) btn.disabled = false;

            var errorMsg = formCfg.errorMessage || 'Something went wrong. Please try again or call us directly.';
            var errorNote = form.querySelector('.form-error');
            if (!errorNote) {
                errorNote = document.createElement('p');
                errorNote.className = 'form-error';
                errorNote.style.color = '#c0392b';
                errorNote.style.fontSize = '0.9rem';
                errorNote.style.marginTop = '8px';
                errorNote.style.textAlign = 'center';
                form.appendChild(errorNote);
            }
            errorNote.textContent = errorMsg;
        }
    }

    form.addEventListener('submit', async function (e) {
        e.preventDefault();
        var formData = new FormData(form);
        var btn = form.querySelector('button[type="submit"]');
        if (btn) btn.disabled = true;

        /* Lock section height so nothing shifts during transitions */
        contactSection.style.minHeight = contactSection.offsetHeight + 'px';

        /* Phase 1: Fade out form */
        form.classList.add('is-fading');
        if (headerP) {
            headerP.style.transition = 'opacity 0.3s ease';
            headerP.style.opacity = '0';
        }

        await sleep(420);
        form.classList.add('is-hidden');
        beginSending(formData);
    });
})();

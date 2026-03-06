export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (request.method === 'POST' && url.pathname === '/api/submit') {
            return handleSubmit(request, env);
        }

        // Server-side meta tag injection for SEO
        if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
            return injectMeta(request, env, url);
        }

        return env.ASSETS.fetch(request);
    }
};

async function injectMeta(request, env, url) {
    try {
        const [htmlRes, contentRes] = await Promise.all([
            env.ASSETS.fetch(new Request(request.url)),
            env.ASSETS.fetch(new Request(new URL('/content.json', url).href)),
        ]);

        if (!htmlRes.ok || !contentRes.ok) return env.ASSETS.fetch(request);

        const [html, content] = await Promise.all([htmlRes.text(), contentRes.json()]);

        const title       = escAttr(content?.meta?.title       || content?.business?.name || '');
        const description = escAttr(content?.meta?.description || '');
        const canonical   = escAttr(url.origin + url.pathname);

        const ogTags = [
            `<meta property="og:type" content="website">`,
            `<meta property="og:url" content="${canonical}">`,
            `<meta property="og:title" content="${title}">`,
            `<meta property="og:description" content="${description}">`,
        ].join('\n    ');

        const out = html
            .replace(/<title>[^<]*<\/title>/, `<title>${escHtml(content?.meta?.title || content?.business?.name || '')}</title>`)
            .replace(/(<meta name="description"[^>]*>)/, `<meta name="description" content="${description}">\n    ${ogTags}`)
            .replace('</head>', `<script>window.__CONTENT_DATA=${JSON.stringify(content)};</script>\n</head>`);

        return new Response(out, {
            status: 200,
            headers: { 'Content-Type': 'text/html;charset=UTF-8' },
        });
    } catch {
        return env.ASSETS.fetch(request);
    }
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

        // Collect all non-system fields, merging first_name+last_name into Name
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

        // Turnstile verification (optional — skipped if secret not configured)
        if (env.TURNSTILE_SECRET_KEY) {
            const token = formData.get('cf-turnstile-response');
            const valid = await verifyTurnstile(token, env.TURNSTILE_SECRET_KEY);
            if (!valid) {
                return jsonError('CAPTCHA verification failed.', 400);
            }
        }

        // Load business info from content.json
        const content = await fetchContent(env, request);
        const ownerEmail = content?.business?.email || env.OWNER_EMAIL;

        if (!ownerEmail) {
            console.error('No owner email configured');
            return jsonError('Server configuration error.', 500);
        }

        const fromEmail = env.FROM_EMAIL || 'noreply@vibefly.ai';
        const site = fromEmail.split('@')[1] || '';

        // Notification to site owner
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

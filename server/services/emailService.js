const nodemailer = require('nodemailer');
const pool = require('../db');

let cachedTransport = null;
let cachedConfiguration = null;

function getMailer() {
    const host = String(process.env.SMTP_HOST ?? '').trim();
    const from = String(process.env.MAIL_FROM ?? '').trim();
    if (!host || !from) return null;

    const port = Number(process.env.SMTP_PORT) || 587;
    const secure = String(process.env.SMTP_SECURE).toLowerCase() === 'true';
    const user = String(process.env.SMTP_USER ?? '').trim();
    const password = process.env.SMTP_PASSWORD ?? '';
    const configurationKey = [host, port, secure, user, password, from].join('\0');

    if (!cachedTransport || cachedConfiguration !== configurationKey) {
        cachedTransport = nodemailer.createTransport({
            host,
            port,
            secure,
            connectionTimeout: 10000,
            greetingTimeout: 10000,
            socketTimeout: 15000,
            ...(user && password ? { auth: { user, pass: password } } : {})
        });
        cachedConfiguration = configurationKey;
    }

    return { transport: cachedTransport, from };
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[character]);
}

async function sendNotificationEmail({ targetId, requestId, content }) {
    try {
        if (!targetId || !content) return false;
        const mailer = getMailer();
        if (!mailer) return false;

        const [employees] = await pool.query(
            'SELECT email, prenom, nom FROM Employe WHERE id = ?',
            [targetId]
        );
        const employee = employees[0];
        if (!employee?.email) return false;

        const appUrl = String(process.env.APP_BASE_URL ?? '').trim().replace(/\/$/, '');
        const greeting = employee.prenom ? `Bonjour ${employee.prenom},` : 'Bonjour,';
        const text = `${greeting}\n\n${content}${appUrl ? `\n\nAccéder à l’application : ${appUrl}` : ''}`;
        const html = `<p>${escapeHtml(greeting)}</p><p>${escapeHtml(content)}</p>${appUrl ? `<p><a href="${escapeHtml(appUrl)}">Accéder à l’application</a></p>` : ''}`;

        await mailer.transport.sendMail({
            from: mailer.from,
            to: employee.email,
            subject: 'Notification - Gestion des congés',
            text,
            html
        });
        return true;
    } catch (error) {
        console.error('[email] Notification delivery failed:', error.message);
        return false;
    }
}

module.exports = { sendNotificationEmail };
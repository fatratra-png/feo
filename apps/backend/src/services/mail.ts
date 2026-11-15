import { config } from '../config';

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Messages "sent" while no provider is configured (dev, tests): read by the test suite. */
export const outbox: Mail[] = [];

export const mailEnabled = () => Boolean(config.mail.resendApiKey);

/**
 * Sends a transactional email through Resend. Without RESEND_API_KEY the
 * message is logged instead, so local development and tests need no account.
 */
export async function sendMail(mail: Mail): Promise<void> {
  if (!mailEnabled()) {
    outbox.push(mail);
    if (outbox.length > 50) outbox.shift();
    if (config.nodeEnv !== 'test') console.log(`[mail] (not sent, no RESEND_API_KEY) to ${mail.to}: ${mail.subject}\n${mail.text}`);
    return;
  }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.mail.resendApiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: config.mail.from, to: [mail.to], subject: mail.subject, text: mail.text, html: mail.html }),
    signal: AbortSignal.timeout(10000),
  });
  if (!r.ok) throw new Error(`Resend: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}

const escape = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function resetPasswordMail(to: string, name: string, link: string): Mail {
  return {
    to,
    subject: 'Réinitialise ton mot de passe FEO',
    text: `Salut ${name},\n\nPour choisir un nouveau mot de passe, ouvre ce lien (valable 1 heure, une seule fois) :\n${link}\n\nSi tu n'as rien demandé, ignore cet email : ton mot de passe reste inchangé.\n\nFEO`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;padding:24px;color:#12100d">
  <p style="font-size:28px;font-weight:800;margin:0 0 24px">FEO<span style="color:#f8d02e">.</span></p>
  <p>Salut ${escape(name)},</p>
  <p>Pour choisir un nouveau mot de passe, clique sur le bouton ci-dessous. Le lien est valable 1 heure et ne fonctionne qu'une fois.</p>
  <p style="margin:28px 0"><a href="${escape(link)}" style="background:#f8d02e;color:#12100d;padding:12px 22px;border-radius:999px;text-decoration:none;font-weight:700">Choisir un nouveau mot de passe</a></p>
  <p style="color:#6b6458;font-size:13px">Si tu n'as rien demandé, ignore cet email : ton mot de passe reste inchangé.</p>
</div>`,
  };
}

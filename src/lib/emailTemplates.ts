// Email templates — bilingual, production-ready HTML for Vision Affichage.
//
// These are pure functions returning { subject, html, text } based on a
// context object. Wire to your email sender (Resend, Postmark, Shopify Email,
// or a Supabase edge function) when you're ready to send live.

const BRAND = {
  navy: '#1B3A6B',
  blue: '#0052CC',
  gold: '#E8A838',
  logoUrl: 'https://visionaffichage.com/cdn/shop/files/Asset_1_d5d82510-0b83-4657-91b7-3ac1992ee697.svg?height=90&v=1769614651',
  site: 'https://visionaffichage.com',
  phone: '367-380-4808',
  email: 'info@visionaffichage.com',
};

type Lang = 'fr' | 'en';

interface EmailOutput {
  subject: string;
  html: string;
  text: string;
}

// Escape user-supplied strings before interpolating into the HTML body.
// Without this, a client whose name was pasted with '<' or '&' (Slack
// copy with formatting, an org name like "Smith & Sons") rendered
// broken markup at best — and at worst, a malicious vendor entry could
// smuggle hidden tracking pixels or rewrite the layout. Use ATTR-safe
// quoting for href values so a URL with a stray '"' can't break out.
function esc(s: string | number | undefined | null): string {
  if (s === undefined || s === null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// First-name extractor that escapes too — every usage was the same
// `${ctx.clientName.split(' ')[0]}` pattern, so centralise + sanitize.
function firstName(full: string | undefined | null): string {
  return esc((full ?? '').split(' ')[0] ?? '');
}

// Currency formatting was duplicated in three places (quote, payment,
// order-confirmation) each spelling out the locale tuple and the CAD
// options object. Lifted here so the locale + currency code are tuned
// in one spot — when we eventually ship USD or another currency the
// per-template branches don't all need to change. Defensive on
// non-finite totals (NaN/Infinity from a malformed cart) — falls back
// to a zero-currency string instead of letting "$NaN" reach a client. */
const CAD_LOCALE: Record<Lang, string> = { fr: 'fr-CA', en: 'en-CA' };
function formatCurrency(total: number, lang: Lang): string {
  const safe = Number.isFinite(total) ? total : 0;
  return safe.toLocaleString(CAD_LOCALE[lang], {
    style: 'currency',
    currency: 'CAD',
  });
}

function wrap(inner: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
</head>
<body style="margin:0;padding:0;background:#f4f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr><td style="background:linear-gradient(135deg,${BRAND.navy} 0%,#0F2341 100%);padding:28px 32px;">
          <img src="${BRAND.logoUrl}" alt="Vision Affichage" height="24" style="display:block;" />
        </td></tr>
        <tr><td style="padding:32px;">${inner}</td></tr>
        <tr><td style="padding:20px 32px;background:#fafafa;border-top:1px solid #eee;font-size:12px;color:#666;text-align:center;">
          Vision Affichage · <a href="${BRAND.site}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.site.replace('https://','')}</a> · ${BRAND.phone}<br/>
          <a href="mailto:${BRAND.email}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.email}</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function button(href: string, label: string): string {
  return `<a href="${esc(href)}" style="display:inline-block;background:${BRAND.blue};color:#fff;padding:14px 28px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;">${esc(label)}</a>`;
}

// ───────────────── Quote sent to client ─────────────────

export interface QuoteSentCtx {
  clientName: string;
  clientEmail: string;
  vendorName: string;
  quoteNumber: string;
  quoteUrl: string;
  total: number;
  expiresAt: string;
  lang?: Lang;
}

export function quoteSentEmail(ctx: QuoteSentCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';
  const totalFmt = formatCurrency(ctx.total, lang);

  if (lang === 'en') {
    return {
      subject: `Your custom quote from Vision Affichage — ${ctx.quoteNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Hi ${firstName(ctx.clientName)},</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          ${esc(ctx.vendorName)} has prepared a custom quote for you. It's ready to review whenever you are —
          upload your logo, confirm the details, and we'll start production.
        </p>
        <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Quote ${esc(ctx.quoteNumber)}</div>
          <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${esc(totalFmt)}</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">Valid until ${esc(ctx.expiresAt)}</div>
        </div>
        <p style="margin:0 0 22px;">${button(ctx.quoteUrl, 'Review & accept quote')}</p>
        <p style="font-size:13px;color:#666;">Delivered in 5 business days · Made in Québec</p>
      `),
      text: `Hi ${ctx.clientName.split(' ')[0]},\n\n${ctx.vendorName} has prepared quote ${ctx.quoteNumber} for you (${totalFmt}).\n\nReview: ${ctx.quoteUrl}\n\nValid until ${ctx.expiresAt}.\nDelivered in 5 business days.`,
    };
  }

  return {
    subject: `Ta soumission personnalisée Vision Affichage — ${ctx.quoteNumber}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Bonjour ${firstName(ctx.clientName)},</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        ${esc(ctx.vendorName)} a préparé une soumission personnalisée pour toi. Elle est prête à être révisée —
        téléverse ton logo, confirme les détails, et on lance la production.
      </p>
      <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Soumission ${esc(ctx.quoteNumber)}</div>
        <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${esc(totalFmt)}</div>
        <div style="font-size:12px;color:#777;margin-top:4px;">Valide jusqu'au ${esc(ctx.expiresAt)}</div>
      </div>
      <p style="margin:0 0 22px;">${button(ctx.quoteUrl, 'Réviser et accepter')}</p>
      <p style="font-size:13px;color:#666;">Livré en 5 jours ouvrables · Fabriqué au Québec</p>
    `),
    text: `Bonjour ${ctx.clientName.split(' ')[0]},\n\n${ctx.vendorName} a préparé la soumission ${ctx.quoteNumber} pour toi (${totalFmt}).\n\nRéviser : ${ctx.quoteUrl}\n\nValide jusqu'au ${ctx.expiresAt}.\nLivré en 5 jours ouvrables.`,
  };
}

// ───────────────── Payment confirmation ─────────────────

export interface PaymentConfirmationCtx {
  clientName: string;
  orderNumber: string;
  total: number;
  etaDate: string;
  trackingUrl?: string;
  lang?: Lang;
}

export function paymentConfirmationEmail(ctx: PaymentConfirmationCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';
  const totalFmt = formatCurrency(ctx.total, lang);

  if (lang === 'en') {
    return {
      subject: `Payment received · Order ${ctx.orderNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Thanks ${firstName(ctx.clientName)} — we got it!</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Your payment of <strong>${esc(totalFmt)}</strong> for order <strong>${esc(ctx.orderNumber)}</strong> was received.
          Production is starting now.
        </p>
        <div style="background:#f0f9ff;border-left:4px solid ${BRAND.blue};padding:14px 18px;border-radius:8px;margin:0 0 22px;">
          <div style="font-weight:800;font-size:14px;margin-bottom:4px;">Estimated delivery: ${esc(ctx.etaDate)}</div>
          <div style="font-size:13px;color:#555;">You'll get a tracking link as soon as it ships.</div>
        </div>
        ${ctx.trackingUrl ? `<p style="margin:0 0 22px;">${button(ctx.trackingUrl, 'Track my order')}</p>` : ''}
        <p style="font-size:13px;color:#666;">Questions? Reply to this email or call us at ${BRAND.phone}.</p>
      `),
      text: `Thanks ${ctx.clientName.split(' ')[0]}! Payment of ${totalFmt} for order ${ctx.orderNumber} received. Estimated delivery: ${ctx.etaDate}.`,
    };
  }

  return {
    subject: `Paiement reçu · Commande ${ctx.orderNumber}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Merci ${firstName(ctx.clientName)} — on l'a reçu !</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        Ton paiement de <strong>${esc(totalFmt)}</strong> pour la commande <strong>${esc(ctx.orderNumber)}</strong> a été reçu.
        La production commence maintenant.
      </p>
      <div style="background:#f0f9ff;border-left:4px solid ${BRAND.blue};padding:14px 18px;border-radius:8px;margin:0 0 22px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:4px;">Livraison estimée : ${esc(ctx.etaDate)}</div>
        <div style="font-size:13px;color:#555;">Tu recevras un lien de suivi dès l'expédition.</div>
      </div>
      ${ctx.trackingUrl ? `<p style="margin:0 0 22px;">${button(ctx.trackingUrl, 'Suivre ma commande')}</p>` : ''}
      <p style="font-size:13px;color:#666;">Des questions ? Réponds à ce courriel ou appelle-nous au ${BRAND.phone}.</p>
    `),
    text: `Merci ${ctx.clientName.split(' ')[0]}! Paiement de ${totalFmt} reçu pour la commande ${ctx.orderNumber}. Livraison estimée: ${ctx.etaDate}.`,
  };
}

// ───────────────── Order shipped ─────────────────

export interface OrderShippedCtx {
  clientName: string;
  orderNumber: string;
  trackingNumber: string;
  trackingUrl: string;
  carrier: string;
  etaDate: string;
  lang?: Lang;
}

export function orderShippedEmail(ctx: OrderShippedCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';

  if (lang === 'en') {
    return {
      subject: `It's on its way · Order ${ctx.orderNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Your order is on the road, ${firstName(ctx.clientName)}.</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Order <strong>${esc(ctx.orderNumber)}</strong> shipped via ${esc(ctx.carrier)}.
          Arrival expected by <strong>${esc(ctx.etaDate)}</strong>.
        </p>
        <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;text-align:center;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Tracking #</div>
          <div style="font-size:16px;font-weight:800;font-family:monospace;">${esc(ctx.trackingNumber)}</div>
        </div>
        <p style="margin:0 0 22px;text-align:center;">${button(ctx.trackingUrl, 'Track package')}</p>
      `),
      text: `Hi ${ctx.clientName.split(' ')[0]}, order ${ctx.orderNumber} shipped via ${ctx.carrier}. Tracking: ${ctx.trackingNumber}. ETA: ${ctx.etaDate}. ${ctx.trackingUrl}`,
    };
  }

  return {
    subject: `C'est en route · Commande ${ctx.orderNumber}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Ta commande est en route, ${firstName(ctx.clientName)}.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        Commande <strong>${esc(ctx.orderNumber)}</strong> expédiée via ${esc(ctx.carrier)}.
        Arrivée prévue d'ici le <strong>${esc(ctx.etaDate)}</strong>.
      </p>
      <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Suivi #</div>
        <div style="font-size:16px;font-weight:800;font-family:monospace;">${esc(ctx.trackingNumber)}</div>
      </div>
      <p style="margin:0 0 22px;text-align:center;">${button(ctx.trackingUrl, 'Suivre le colis')}</p>
    `),
    text: `Bonjour ${ctx.clientName.split(' ')[0]}, commande ${ctx.orderNumber} expédiée via ${ctx.carrier}. Suivi: ${ctx.trackingNumber}. Arrivée: ${ctx.etaDate}. ${ctx.trackingUrl}`,
  };
}

// ───────────────── Order delivered ─────────────────

export interface OrderDeliveredCtx {
  clientName: string;
  orderNumber: string;
  reviewUrl?: string;
  lang?: Lang;
}

export function orderDeliveredEmail(ctx: OrderDeliveredCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';

  if (lang === 'en') {
    return {
      subject: `Delivered — how did we do?`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Your merch arrived, ${firstName(ctx.clientName)}.</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Order <strong>${esc(ctx.orderNumber)}</strong> has been delivered. We hope the print looks as sharp in person as it did on your screen.
        </p>
        ${ctx.reviewUrl ? `<p style="margin:0 0 22px;">${button(ctx.reviewUrl, 'Leave a 30-second review')}</p>` : ''}
        <p style="font-size:13px;color:#666;">Thanks for trusting Vision Affichage. Ready to reorder? Reply to this email.</p>
      `),
      text: `Your order ${ctx.orderNumber} has been delivered. Thanks for choosing Vision Affichage!${ctx.reviewUrl ? ` Review: ${ctx.reviewUrl}` : ''}`,
    };
  }

  return {
    subject: `Livré — comment on s'en est tiré ?`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Ton merch est arrivé, ${firstName(ctx.clientName)}.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        La commande <strong>${esc(ctx.orderNumber)}</strong> a été livrée. On espère que l'impression te plaît autant en vrai qu'à l'écran.
      </p>
      ${ctx.reviewUrl ? `<p style="margin:0 0 22px;">${button(ctx.reviewUrl, 'Laisse un avis en 30 sec')}</p>` : ''}
      <p style="font-size:13px;color:#666;">Merci de faire confiance à Vision Affichage. Prêt à recommander ? Réponds à ce courriel.</p>
    `),
    text: `Ta commande ${ctx.orderNumber} a été livrée. Merci d'avoir choisi Vision Affichage!${ctx.reviewUrl ? ` Avis: ${ctx.reviewUrl}` : ''}`,
  };
}

// ───────────────── Order confirmation ─────────────────
//
// Sent right after an order is placed (pre-payment-capture for offline methods,
// or right after checkout for card). Separate from paymentConfirmationEmail,
// which fires once payment is actually captured. Uses the same wrap() chrome
// so the footer/signature stays consistent with the rest of the library.

export interface OrderConfirmationCtx {
  clientName: string;
  orderNumber: string;
  total: number;
  etaDate: string;
  lang?: Lang;
}

export function orderConfirmationEmail(ctx: OrderConfirmationCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';
  const totalFmt = formatCurrency(ctx.total, lang);

  if (lang === 'en') {
    return {
      subject: `Vision Affichage — order confirmation #${ctx.orderNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Order confirmed, ${firstName(ctx.clientName)}!</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          We got your order <strong>#${esc(ctx.orderNumber)}</strong>. A quick recap below —
          we'll send another note as soon as production wraps and your package is on the move.
        </p>
        <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Order #${esc(ctx.orderNumber)}</div>
          <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${esc(totalFmt)}</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">Estimated delivery: ${esc(ctx.etaDate)}</div>
        </div>
        <p style="font-size:13px;color:#666;">Questions? Email <a href="mailto:${BRAND.email}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.email}</a> or call ${BRAND.phone}.</p>
      `),
      text: `Hi ${ctx.clientName.split(' ')[0]},\n\nOrder #${ctx.orderNumber} confirmed — total ${totalFmt}.\nEstimated delivery: ${ctx.etaDate}.\n\nQuestions? ${BRAND.email}`,
    };
  }

  return {
    subject: `Vision Affichage — confirmation de commande #${ctx.orderNumber}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Commande confirmée, ${firstName(ctx.clientName)} !</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        On a bien reçu ta commande <strong>#${esc(ctx.orderNumber)}</strong>. Un petit récap ci-dessous —
        on te renverra un courriel dès que la production est terminée et que ton colis part.
      </p>
      <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Commande #${esc(ctx.orderNumber)}</div>
        <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${esc(totalFmt)}</div>
        <div style="font-size:12px;color:#777;margin-top:4px;">Livraison estimée : ${esc(ctx.etaDate)}</div>
      </div>
      <p style="font-size:13px;color:#666;">Des questions ? Écris à <a href="mailto:${BRAND.email}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.email}</a> ou appelle au ${BRAND.phone}.</p>
    `),
    text: `Bonjour ${ctx.clientName.split(' ')[0]},\n\nCommande #${ctx.orderNumber} confirmée — total ${totalFmt}.\nLivraison estimée : ${ctx.etaDate}.\n\nDes questions ? ${BRAND.email}`,
  };
}

// ───────────────── Password reset ─────────────────
//
// Fired when a user requests a reset link from the sign-in page. The reset URL
// is expected to already carry the one-time token; this template is just the
// presentation layer. Keep expiry copy generic (no hard-coded TTL) so auth
// backends can swap the window without editing the template.

export interface PasswordResetCtx {
  clientName?: string;
  resetUrl: string;
  lang?: Lang;
}

export function passwordResetEmail(ctx: PasswordResetCtx): EmailOutput {
  const lang = ctx.lang ?? 'fr';
  const name = ctx.clientName ? firstName(ctx.clientName) : '';

  if (lang === 'en') {
    return {
      subject: `Vision Affichage — reset your password`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">${name ? `Hi ${name},` : 'Hi there,'}</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          We got a request to reset the password on your Vision Affichage account.
          Click the button below to pick a new one — the link expires shortly for your safety.
        </p>
        <p style="margin:0 0 22px;">${button(ctx.resetUrl, 'Reset password')}</p>
        <p style="font-size:13px;color:#666;line-height:1.6;">
          Didn't ask for this? You can ignore this email — your current password stays active.
          Need help? Email <a href="mailto:${BRAND.email}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.email}</a>.
        </p>
      `),
      text: `${name ? `Hi ${name},\n\n` : ''}Reset your Vision Affichage password: ${ctx.resetUrl}\n\nThe link expires shortly. If you didn't request this, ignore this email.`,
    };
  }

  return {
    subject: `Vision Affichage — réinitialiser ton mot de passe`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">${name ? `Bonjour ${name},` : 'Bonjour,'}</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        On a reçu une demande pour réinitialiser le mot de passe de ton compte Vision Affichage.
        Clique sur le bouton ci-dessous pour en choisir un nouveau — le lien expire bientôt pour ta sécurité.
      </p>
      <p style="margin:0 0 22px;">${button(ctx.resetUrl, 'Réinitialiser le mot de passe')}</p>
      <p style="font-size:13px;color:#666;line-height:1.6;">
        Ce n'était pas toi ? Ignore ce courriel — ton mot de passe actuel reste valide.
        Besoin d'aide ? Écris à <a href="mailto:${BRAND.email}" style="color:${BRAND.blue};text-decoration:none;">${BRAND.email}</a>.
      </p>
    `),
    text: `${name ? `Bonjour ${name},\n\n` : ''}Réinitialise ton mot de passe Vision Affichage : ${ctx.resetUrl}\n\nLe lien expire bientôt. Si ce n'était pas toi, ignore ce courriel.`,
  };
}

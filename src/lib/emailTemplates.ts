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
  return `<a href="${href}" style="display:inline-block;background:${BRAND.blue};color:#fff;padding:14px 28px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;">${label}</a>`;
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
  const totalFmt = ctx.total.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' });

  if (lang === 'en') {
    return {
      subject: `Your custom quote from Vision Affichage — ${ctx.quoteNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Hi ${ctx.clientName.split(' ')[0]},</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          ${ctx.vendorName} has prepared a custom quote for you. It's ready to review whenever you are —
          upload your logo, confirm the details, and we'll start production.
        </p>
        <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Quote ${ctx.quoteNumber}</div>
          <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${totalFmt}</div>
          <div style="font-size:12px;color:#777;margin-top:4px;">Valid until ${ctx.expiresAt}</div>
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
      <h1 style="font-size:22px;margin:0 0 12px;">Bonjour ${ctx.clientName.split(' ')[0]},</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        ${ctx.vendorName} a préparé une soumission personnalisée pour toi. Elle est prête à être révisée —
        téléverse ton logo, confirme les détails, et on lance la production.
      </p>
      <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Soumission ${ctx.quoteNumber}</div>
        <div style="font-size:26px;font-weight:800;color:${BRAND.navy};">${totalFmt}</div>
        <div style="font-size:12px;color:#777;margin-top:4px;">Valide jusqu'au ${ctx.expiresAt}</div>
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
  const totalFmt = ctx.total.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA', { style: 'currency', currency: 'CAD' });

  if (lang === 'en') {
    return {
      subject: `Payment received · Order ${ctx.orderNumber}`,
      html: wrap(`
        <h1 style="font-size:22px;margin:0 0 12px;">Thanks ${ctx.clientName.split(' ')[0]} — we got it!</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Your payment of <strong>${totalFmt}</strong> for order <strong>${ctx.orderNumber}</strong> was received.
          Production is starting now.
        </p>
        <div style="background:#f0f9ff;border-left:4px solid ${BRAND.blue};padding:14px 18px;border-radius:8px;margin:0 0 22px;">
          <div style="font-weight:800;font-size:14px;margin-bottom:4px;">Estimated delivery: ${ctx.etaDate}</div>
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
      <h1 style="font-size:22px;margin:0 0 12px;">Merci ${ctx.clientName.split(' ')[0]} — on l'a reçu !</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        Ton paiement de <strong>${totalFmt}</strong> pour la commande <strong>${ctx.orderNumber}</strong> a été reçu.
        La production commence maintenant.
      </p>
      <div style="background:#f0f9ff;border-left:4px solid ${BRAND.blue};padding:14px 18px;border-radius:8px;margin:0 0 22px;">
        <div style="font-weight:800;font-size:14px;margin-bottom:4px;">Livraison estimée : ${ctx.etaDate}</div>
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
        <h1 style="font-size:22px;margin:0 0 12px;">Your order is on the road, ${ctx.clientName.split(' ')[0]}.</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Order <strong>${ctx.orderNumber}</strong> shipped via ${ctx.carrier}.
          Arrival expected by <strong>${ctx.etaDate}</strong>.
        </p>
        <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;text-align:center;">
          <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Tracking #</div>
          <div style="font-size:16px;font-weight:800;font-family:monospace;">${ctx.trackingNumber}</div>
        </div>
        <p style="margin:0 0 22px;text-align:center;">${button(ctx.trackingUrl, 'Track package')}</p>
      `),
      text: `Hi ${ctx.clientName.split(' ')[0]}, order ${ctx.orderNumber} shipped via ${ctx.carrier}. Tracking: ${ctx.trackingNumber}. ETA: ${ctx.etaDate}. ${ctx.trackingUrl}`,
    };
  }

  return {
    subject: `C'est en route · Commande ${ctx.orderNumber}`,
    html: wrap(`
      <h1 style="font-size:22px;margin:0 0 12px;">Ta commande est en route, ${ctx.clientName.split(' ')[0]}.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        Commande <strong>${ctx.orderNumber}</strong> expédiée via ${ctx.carrier}.
        Arrivée prévue d'ici le <strong>${ctx.etaDate}</strong>.
      </p>
      <div style="background:#f8f9fb;border-radius:12px;padding:16px;margin:0 0 22px;text-align:center;">
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:${BRAND.blue};font-weight:800;margin-bottom:6px;">Suivi #</div>
        <div style="font-size:16px;font-weight:800;font-family:monospace;">${ctx.trackingNumber}</div>
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
        <h1 style="font-size:22px;margin:0 0 12px;">Your merch arrived, ${ctx.clientName.split(' ')[0]}.</h1>
        <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
          Order <strong>${ctx.orderNumber}</strong> has been delivered. We hope the print looks as sharp in person as it did on your screen.
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
      <h1 style="font-size:22px;margin:0 0 12px;">Ton merch est arrivé, ${ctx.clientName.split(' ')[0]}.</h1>
      <p style="font-size:15px;line-height:1.6;margin:0 0 18px;">
        La commande <strong>${ctx.orderNumber}</strong> a été livrée. On espère que l'impression te plaît autant en vrai qu'à l'écran.
      </p>
      ${ctx.reviewUrl ? `<p style="margin:0 0 22px;">${button(ctx.reviewUrl, 'Laisse un avis en 30 sec')}</p>` : ''}
      <p style="font-size:13px;color:#666;">Merci de faire confiance à Vision Affichage. Prêt à recommander ? Réponds à ce courriel.</p>
    `),
    text: `Ta commande ${ctx.orderNumber} a été livrée. Merci d'avoir choisi Vision Affichage!${ctx.reviewUrl ? ` Avis: ${ctx.reviewUrl}` : ''}`,
  };
}

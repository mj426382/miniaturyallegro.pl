/**
 * One look for every e-mail AllGrafika sends (spec 16). Inputs are plain text; everything that reaches
 * the HTML is escaped, so user-provided text (names, admin messages) cannot inject markup.
 */
export interface EmailContent {
  heading: string;
  /** Plain-text paragraphs; single line breaks are kept. */
  paragraphs: string[];
  cta?: { label: string; url: string };
  /** Small print under the message (e.g. why the mail was sent, unsubscribe link). */
  footer?: Array<string | { text: string; link: { label: string; url: string } }>;
}

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Only http(s) links are rendered as links – anything else is dropped. */
function safeUrl(url: string): string {
  return /^https?:\/\//i.test(url) ? escapeHtml(url) : '#';
}

export function renderEmail(content: EmailContent): { html: string; text: string } {
  const paragraphsHtml = content.paragraphs
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const ctaHtml = content.cta
    ? `<p style="margin:22px 0"><a href="${safeUrl(content.cta.url)}" style="background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:8px;display:inline-block;font-weight:600">${escapeHtml(content.cta.label)}</a></p>`
    : '';
  const footerHtml = (content.footer ?? [])
    .map((f) =>
      typeof f === 'string'
        ? `<p style="margin:0 0 6px">${escapeHtml(f)}</p>`
        : `<p style="margin:0 0 6px">${escapeHtml(f.text)} <a href="${safeUrl(f.link.url)}" style="color:#6b7280">${escapeHtml(f.link.label)}</a></p>`,
    )
    .join('');

  const html =
    '<!doctype html><html lang="pl"><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">' +
    '<div style="max-width:560px;margin:0 auto;padding:24px">' +
    '<p style="margin:0 0 16px;font-weight:700;font-size:18px;color:#2563eb">AllGrafika</p>' +
    '<div style="background:#ffffff;border-radius:12px;padding:24px">' +
    `<h1 style="font-size:20px;margin:0 0 16px">${escapeHtml(content.heading)}</h1>` +
    paragraphsHtml +
    ctaHtml +
    '</div>' +
    `<div style="font-size:12px;color:#6b7280;padding:16px 4px">${footerHtml}</div>` +
    '</div></body></html>';

  const text = [
    content.heading,
    '',
    ...content.paragraphs.flatMap((p) => [p, '']),
    ...(content.cta ? [`${content.cta.label}: ${content.cta.url}`, ''] : []),
    ...(content.footer ?? []).map((f) => (typeof f === 'string' ? f : `${f.text} ${f.link.label}: ${f.link.url}`)),
  ]
    .join('\n')
    .trim();

  return { html, text };
}

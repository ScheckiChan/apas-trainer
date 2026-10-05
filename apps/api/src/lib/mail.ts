/**
 * Magic-link delivery.
 *
 * TODO(smtp): This is a deliberate STUB. v1 does not send real e-mails — the link is
 * logged to the API console instead. Wiring a real SMTP / mail provider is a follow-up
 * (to be decided with Daniel). Replace the body of `sendMagicLink()` only; callers
 * do not need to change.
 */
export interface MagicLinkMail {
  to: string;
  name: string;
  gruppeName: string;
  link: string;
  expiresInMinutes: number;
}

export async function sendMagicLink(mail: MagicLinkMail): Promise<void> {
  console.log(
    [
      '',
      '──────────────── MAGIC LINK (E-Mail-Stub) ────────────────',
      `An:      ${mail.name} <${mail.to}>`,
      `Gruppe:  ${mail.gruppeName}`,
      `Gültig:  ${mail.expiresInMinutes} Minuten`,
      `Link:    ${mail.link}`,
      '──────────────────────────────────────────────────────────',
      '',
    ].join('\n'),
  );
}

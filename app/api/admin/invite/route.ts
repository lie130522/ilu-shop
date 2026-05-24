// POST /api/admin/invite
// Body: { email, token, permissions[], invitedByName }
// Envoie un email d'invitation admin via Resend.

import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export const maxDuration = 10;

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

function buildInviteEmail(opts: {
  email: string;
  token: string;
  invitedByName: string;
  permissions: string[];
}): string {
  const link = `${APP_URL}/admin/invitation/${opts.token}`;
  const permsList = opts.permissions
    .map((p) => `<li style="margin:4px 0;">${p}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF7F4;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#FAF7F4;padding:40px 0;">
    <tr><td align="center">
      <table width="540" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E8DDD5;">
        <!-- Header -->
        <tr>
          <td style="background:#1C1410;padding:32px 40px;text-align:center;">
            <div style="font-family:Georgia,serif;font-size:22px;font-weight:700;letter-spacing:6px;color:#FAF7F4;text-transform:uppercase;">
              ILU SHOP
            </div>
            <div style="margin-top:4px;font-size:11px;letter-spacing:3px;color:#C8A882;text-transform:uppercase;">
              Administration
            </div>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 16px;font-size:24px;color:#1C1410;font-weight:700;">
              Invitation à l&apos;équipe admin
            </h1>
            <p style="margin:0 0 16px;color:#5A4A3A;font-size:15px;line-height:1.6;">
              Bonjour,<br><br>
              <strong>${opts.invitedByName}</strong> vous invite à rejoindre l&apos;équipe d&apos;administration d&apos;ILU SHOP.
            </p>
            ${opts.permissions.length > 0 ? `
            <div style="background:#FAF7F4;border-radius:8px;padding:16px 20px;margin:20px 0;">
              <div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#C8573A;font-weight:700;margin-bottom:8px;">
                Permissions accordées
              </div>
              <ul style="margin:0;padding-left:20px;color:#1C1410;font-size:14px;">
                ${permsList}
              </ul>
            </div>` : ''}
            <p style="margin:0 0 24px;color:#5A4A3A;font-size:14px;line-height:1.6;">
              Ce lien est valable <strong>48 heures</strong>. Cliquez ci-dessous pour créer votre accès :
            </p>
            <!-- CTA -->
            <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr>
                <td style="background:#C8573A;border-radius:50px;padding:14px 36px;text-align:center;">
                  <a href="${link}" style="color:#FAF7F4;font-size:13px;font-weight:700;letter-spacing:3px;text-transform:uppercase;text-decoration:none;">
                    Accepter l&apos;invitation →
                  </a>
                </td>
              </tr>
            </table>
            <!-- Fallback link -->
            <p style="margin:24px 0 0;color:#9A8778;font-size:12px;text-align:center;">
              Ou copiez ce lien dans votre navigateur :<br>
              <a href="${link}" style="color:#C8573A;word-break:break-all;">${link}</a>
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="background:#FAF7F4;padding:20px 40px;border-top:1px solid #E8DDD5;text-align:center;">
            <p style="margin:0;color:#9A8778;font-size:11px;line-height:1.6;">
              Si vous n&apos;attendiez pas cette invitation, ignorez simplement cet email.<br>
              ILU SHOP — Kinshasa, République Démocratique du Congo
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      email?: string;
      token?: string;
      permissions?: string[];
      invitedByName?: string;
    };

    const { email, token, permissions = [], invitedByName = 'L\'équipe ILU SHOP' } = body;

    if (!email || !token) {
      return NextResponse.json({ error: 'email et token requis' }, { status: 400 });
    }

    const { data, error } = await resend.emails.send({
      from: FROM,
      to: email,
      subject: 'Invitation à rejoindre l\'équipe ILU SHOP Admin',
      html: buildInviteEmail({ email, token, invitedByName, permissions }),
    });

    if (error) {
      console.error('[invite] Resend error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ id: data?.id }, { status: 200 });
  } catch (err) {
    console.error('[invite] Unexpected error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

import nodemailer from 'nodemailer'

export function createTransporter() {
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.replace(/\s+/g, '')
  if (!user || !pass || user.includes('your-gmail') || pass.includes('your-gmail')) {
    throw new Error('SMTP is not configured. Update .env with SMTP_USER and SMTP_PASS.')
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user, pass },
  })
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const OTP_COPY = {
  login: {
    subject: 'Your ESP DevOps sign-in code',
    kicker: 'Sign in',
    title: 'Verification code',
    line: 'Use this one-time code to sign in to ESP DevOps Portal.',
  },
  '2fa': {
    subject: 'Your ESP DevOps 2FA code',
    kicker: 'Two-factor',
    title: 'Two-factor code',
    line: 'Enter this code to finish signing in.',
  },
  '2fa-setup': {
    subject: 'Enable two-factor authentication',
    kicker: 'Security',
    title: 'Enable 2FA',
    line: 'Use this code to turn on two-factor authentication for your account.',
  },
  '2fa-disable': {
    subject: 'Disable two-factor authentication',
    kicker: 'Security',
    title: 'Disable 2FA',
    line: 'Use this code to turn off two-factor authentication for your account.',
  },
}

const ROLE_COPY = {
  Viewer: 'Read-only access to the dashboard, projects, network, and shortcuts.',
  Developer: 'Access to APIs, secret values you are allowed to view, and shortcuts.',
  DevOps: 'Access to infrastructure, secrets, SSH, and project management.',
  Admin: 'Full workspace access, including invitations and settings.',
}

function layout({ preheader, kicker, title, bodyHtml }) {
  const safePreheader = escapeHtml(preheader)
  const safeKicker = escapeHtml(kicker)
  const safeTitle = escapeHtml(title)

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#e8edf5;color:#0f172a;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${safePreheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#e8edf5;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #dbe3ef;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
            <tr>
              <td style="background:#0a101c;padding:22px 28px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="width:40px;vertical-align:middle;">
                      <div style="width:36px;height:36px;border-radius:10px;background:#22d3ee;color:#082f49;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:36px;text-align:center;">ESP</div>
                    </td>
                    <td style="padding-left:12px;vertical-align:middle;">
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.16em;color:#67e8f9;text-transform:uppercase;">ESP Platform</div>
                      <div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:700;color:#f8fafc;line-height:1.3;">DevOps Portal</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#6d5efc;font-weight:700;margin-bottom:8px;">${safeKicker}</div>
                <h1 style="margin:0 0 12px;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.3;color:#0f172a;">${safeTitle}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:0 28px 24px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:16px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
                  This message was sent by ESP DevOps Portal. If you did not expect it, you can ignore this email.
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function sendMail({ to, subject, text, html }) {
  const transporter = createTransporter()
  const from = process.env.MAIL_FROM || process.env.SMTP_USER
  await transporter.sendMail({ from, to, subject, text, html })
}

export async function sendInviteEmail(to, role, loginUrl) {
  const safeRole = escapeHtml(role)
  const safeUrl = escapeHtml(loginUrl)
  const roleHint = escapeHtml(ROLE_COPY[role] || 'Access to the ESP DevOps workspace.')
  const html = layout({
    preheader: `You have been invited to ESP DevOps Portal as ${role}.`,
    kicker: 'Workspace invite',
    title: 'You are invited',
    bodyHtml: `
      <p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
        An administrator invited <strong style="color:#0f172a;">${escapeHtml(to)}</strong> to join ESP DevOps Portal.
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
        <tr>
          <td style="padding:16px 18px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;">Permission</div>
            <div style="margin-top:4px;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#6d5efc;">${safeRole}</div>
            <div style="margin-top:6px;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:#475569;">${roleHint}</div>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
        Sign in with this email address to accept the invitation and open the workspace.
      </p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px;">
        <tr>
          <td style="border-radius:10px;background:#6d5efc;">
            <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Sign in to ESP DevOps</a>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;color:#64748b;">
        If the button does not work, copy this link:<br />
        <a href="${safeUrl}" style="color:#6d5efc;word-break:break-all;">${safeUrl}</a>
      </p>
    `,
  })

  await sendMail({
    to,
    subject: `Invitation to ESP DevOps Portal · ${role}`,
    text: `You have been invited to ESP DevOps Portal as ${role}. ${ROLE_COPY[role] || ''} Sign in at ${loginUrl}`,
    html,
  })
}

export async function sendOtpEmail(to, otp, purpose = 'login') {
  const minutes = process.env.OTP_TTL_MINUTES || '5'
  const copy = OTP_COPY[purpose] || OTP_COPY.login
  const safeOtp = escapeHtml(otp)
  const html = layout({
    preheader: `${copy.line} ${otp}`,
    kicker: copy.kicker,
    title: copy.title,
    bodyHtml: `
      <p style="margin:0 0 18px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#334155;">
        ${escapeHtml(copy.line)}
      </p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#0a101c;border-radius:12px;">
        <tr>
          <td align="center" style="padding:22px 16px;">
            <div style="font-family:Consolas,'Courier New',monospace;font-size:32px;letter-spacing:10px;font-weight:700;color:#67e8f9;line-height:1;">${safeOtp}</div>
            <div style="margin-top:10px;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#94a3b8;">Expires in ${escapeHtml(minutes)} minutes</div>
          </td>
        </tr>
      </table>
      <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.6;color:#64748b;">
        Do not share this code. ESP staff will never ask for it.
      </p>
    `,
  })

  await sendMail({
    to,
    subject: copy.subject,
    text: `${copy.line} ${otp}. It expires in ${minutes} minutes. Do not share this code.`,
    html,
  })
}

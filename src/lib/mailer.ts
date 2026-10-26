import nodemailer, { type Transporter } from 'nodemailer';

// Gmail SMTP로 메일 발송 (GMAIL_USER: 보내는 Gmail 주소, GMAIL_APP_PASSWORD: Google 계정의 16자리 앱 비밀번호)
export const isMailerConfigured = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

let transporter: Transporter | null = null;

function getTransporter() {
  transporter ??= process.env.SMTP_HOST
    ? // Gmail 대신 다른 SMTP 서버를 쓸 때 (예: 로컬 테스트용 메일 서버)
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_PORT === '465',
        ignoreTLS: process.env.SMTP_HOST === '127.0.0.1',
      })
    : nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, ''), // 앱 비밀번호의 띄어쓰기는 무시
        },
      });
  return transporter;
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export async function sendPasswordEmail(to: string, nickname: string, username: string, password: string) {
  const name = escapeHtml(nickname);
  await getTransporter().sendMail({
    from: `ClassMate <${process.env.GMAIL_USER}>`,
    to,
    subject: '[ClassMate] 비밀번호 찾기 안내',
    text: `${nickname}님, ClassMate 비밀번호 찾기를 요청하셨어요.\n\n아이디: ${username}\n비밀번호: ${password}\n\n본인이 요청하지 않았다면 로그인 후 설정에서 비밀번호를 바꿔 주세요.`,
    html: `
      <div style="font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;max-width:440px;margin:0 auto;padding:24px;color:#182033">
        <h2 style="margin:0 0 8px;font-size:20px">ClassMate 비밀번호 찾기</h2>
        <p style="margin:0 0 20px;color:#7b8498;font-size:14px">${name}님, 요청하신 계정 정보예요.</p>
        <div style="background:#f7f8ff;border:1px dashed #c9d1ff;border-radius:12px;padding:16px">
          <p style="margin:0 0 6px;font-size:13px;color:#7b8498">아이디</p>
          <p style="margin:0 0 14px;font-size:16px;font-weight:700">${escapeHtml(username)}</p>
          <p style="margin:0 0 6px;font-size:13px;color:#7b8498">비밀번호</p>
          <p style="margin:0;font-size:20px;font-weight:800;color:#536dfe;word-break:break-all">${escapeHtml(password)}</p>
        </div>
        <p style="margin:20px 0 0;font-size:12px;color:#7b8498;line-height:1.6">
          본인이 요청하지 않았다면 로그인한 뒤 설정 → 내 계정에서 비밀번호를 바꿔 주세요.
        </p>
      </div>`,
  });
}

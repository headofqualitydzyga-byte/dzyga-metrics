import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export async function sendInvitationEmail({
  to,
  inviteUrl,
  role,
  departmentName,
}: {
  to: string;
  inviteUrl: string;
  role: string;
  departmentName?: string;
}) {
  const roleLabel =
    role === "admin" ? "Адміністратор" : role === "viewer" ? "CEO / Спостерігач" : "Керівник відділу";

  await transporter.sendMail({
    from: `"Dzyga Metrics" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Запрошення до Dzyga Metrics",
    html: `
<!DOCTYPE html>
<html lang="uk">
<head><meta charset="utf-8" /></head>
<body style="font-family: Arial, sans-serif; background: #f4f5f7; padding: 32px;">
  <div style="max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #e6e8ec;">
    <h1 style="margin: 0 0 8px; font-size: 22px; color: #1f2733;">
      Dzyga <span style="color: #e5672a;">Metrics</span>
    </h1>
    <p style="color: #8993a4; margin: 0 0 24px; font-size: 14px;">
      Вас запрошено до системи метрик
    </p>
    <div style="background: #fbeae0; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
      <p style="margin: 0; font-size: 14px; color: #1f2733;">
        <strong>Роль:</strong> ${roleLabel}<br/>
        ${departmentName ? `<strong>Відділ:</strong> ${departmentName}<br/>` : ""}
        <strong>Email:</strong> ${to}
      </p>
    </div>
    <a href="${inviteUrl}"
       style="display: inline-block; background: #e5672a; color: #fff; padding: 12px 24px;
              border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 600;">
      Прийняти запрошення
    </a>
    <p style="margin: 24px 0 0; font-size: 12px; color: #8993a4;">
      Посилання дійсне 7 днів. Якщо ви не очікували цього листа — проігноруйте його.
    </p>
  </div>
</body>
</html>`,
  });
}

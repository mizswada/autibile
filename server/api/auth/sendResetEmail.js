// Make sure to install nodemailer: npm install nodemailer
import { randomBytes } from "crypto";
import nodemailer from "nodemailer";

// Add this helper function
async function sendEmail({ to, subject, html }) {
  // Configure your SMTP transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || '"Support" <support@example.com>',
    to,
    subject,
    html,
  });
}

export default defineEventHandler(async (event) => {
  if (event.req.method !== "POST") {
    return { status: 405, message: "Method Not Allowed" };
  }

  const body = await readBody(event);
  const { email } = body;

  if (!email) {
    return { status: 400, message: "Email is required." };
  }

  // Find user by email
  const user = await prisma.user.findFirst({ where: { userEmail: email } });
  if (!user) {
    return { status: 404, message: "User not found." };
  }

  // Generate a token (for demo, random string; in production, store in DB with expiry)
  const token = randomBytes(32).toString("hex");

  // Optionally: Save token and expiry to user or a password_reset table
  // await prisma.passwordReset.create({ data: { userID: user.userID, token, expiresAt: ... } });

  // Construct reset link
  const baseUrl = process.env.BASE_URL || "http://localhost:3000";
  const resetLink = `${baseUrl}/reset-password?token=${token}`;

  //Send email (replace with your email logic)
  await sendEmail({
    to: email,
    subject: "Password Reset",
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
  });

  // For demo, just log the link
  console.log(`Reset link for ${email}: ${resetLink}`);

  return { status: 200, message: "Reset email sent." };
});

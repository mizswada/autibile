import nodemailer from "nodemailer";

export function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

export async function sendAccountRequestEmail({ to, subject, html, replyTo }) {
  if (!process.env.SMTP_HOST || !to) return;

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
    from: process.env.SMTP_FROM || '"Autibile Support" <support@autibile.my>',
    to,
    replyTo,
    subject,
    html,
  });
}

export async function getAdminNotificationEmail() {
  let supportEmails = [];
  try {
    const techSupports = await prisma.tech_supports.findMany({
      where: {
        deleted_at: null,
        OR: [{ techSupport_status: "ACTIVE" }, { techSupport_status: "Active" }],
      },
      select: { techSupport_email: true },
      orderBy: { techSupport_ID: "asc" },
    });
    supportEmails = techSupports
      .map((item) => item.techSupport_email)
      .filter(Boolean);

    if (supportEmails.length === 0) {
      const anySupports = await prisma.tech_supports.findMany({
        where: { deleted_at: null },
        select: { techSupport_email: true },
        orderBy: { techSupport_ID: "asc" },
      });
      supportEmails = anySupports
        .map((item) => item.techSupport_email)
        .filter(Boolean);
    }
  } catch (e) {
    console.log("Unable to load tech supports for account request:", e);
  }

  return (
    process.env.DELETE_ACCOUNT_EMAIL ||
    supportEmails[0] ||
    process.env.SMTP_FROM ||
    process.env.SMTP_USER
  );
}

export const REQUEST_TYPES = {
  PASSWORD_RESET: "PasswordReset",
  ACCOUNT_DELETION: "AccountDeletion",
};

export const ALLOWED_ACCOUNT_TYPES = ["Parents", "Doctor", "Therapist"];

export async function findRegisteredUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();

  return prisma.user.findFirst({
    where: {
      OR: [
        { userEmail: email },
        { userEmail: normalizedEmail },
        { userUsername: email },
        { userUsername: normalizedEmail },
      ],
    },
    include: {
      userrole: {
        include: {
          role: {
            select: { roleName: true },
          },
        },
      },
      user_practitioners: {
        where: { deleted_at: null },
        select: {
          type: true,
          status: true,
        },
      },
      user_parents: {
        where: { deleted_at: null },
        select: {
          parent_id: true,
          parent_status: true,
        },
      },
    },
  });
}

export function accountTypeMatchesUser(accountType, registeredUser) {
  const roleNames = (registeredUser.userrole || [])
    .map((item) => item.role?.roleName)
    .filter(Boolean);
  const practitionerTypes = (registeredUser.user_practitioners || [])
    .map((item) => item.type)
    .filter(Boolean);

  if (accountType === "Parents") {
    return (
      roleNames.includes("Parents") ||
      (registeredUser.user_parents || []).length > 0
    );
  }
  if (accountType === "Doctor") {
    return practitionerTypes.includes("Doctor");
  }
  if (accountType === "Therapist") {
    return practitionerTypes.includes("Therapist");
  }
  return false;
}

export async function findOpenAccountRequest({ email, requestType }) {
  const normalizedEmail = email.toLowerCase();
  return prisma.account_deletion_requests.findFirst({
    where: {
      deleted_at: null,
      request_type: requestType,
      status: { in: ["Pending", "In Progress"] },
      OR: [{ email }, { email: normalizedEmail }],
    },
    orderBy: { created_at: "desc" },
  });
}

export async function findRecentAccountRequest({ email, requestType, minutes = 5 }) {
  const normalizedEmail = email.toLowerCase();
  const since = new Date(Date.now() - minutes * 60 * 1000);

  return prisma.account_deletion_requests.findFirst({
    where: {
      deleted_at: null,
      request_type: requestType,
      created_at: { gte: since },
      OR: [{ email }, { email: normalizedEmail }],
    },
    orderBy: { created_at: "desc" },
  });
}

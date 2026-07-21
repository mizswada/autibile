import { DateTime } from "luxon";
import nodemailer from "nodemailer";

async function sendEmail({ to, subject, html, replyTo }) {
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

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    const fullName = (body?.fullName || "").trim();
    const email = (body?.email || "").trim();
    const accountType = (body?.accountType || "").trim();
    const additionalInfo = (body?.additionalInfo || "").trim();

    if (!fullName || !email) {
      return {
        statusCode: 400,
        message: "Full name and account email are required.",
      };
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return {
        statusCode: 400,
        message: "Please provide a valid email address.",
      };
    }

    const allowedTypes = ["Parents", "Doctor", "Therapist"];
    if (!allowedTypes.includes(accountType)) {
      return {
        statusCode: 400,
        message: "Please select a valid account type.",
      };
    }

    const resolvedType = accountType;
    const normalizedEmail = email.toLowerCase();

    // Match registered Autibile accounts (email is used as login)
    const registeredUser = await prisma.user.findFirst({
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

    if (!registeredUser) {
      return {
        statusCode: 404,
        message:
          "No Autibile account was found with this email. Please use the email you registered with.",
      };
    }

    if (
      registeredUser.userStatus &&
      ["DELETED", "Deleted", "deleted"].includes(registeredUser.userStatus)
    ) {
      return {
        statusCode: 400,
        message: "This Autibile account has already been deleted.",
      };
    }

    const roleNames = (registeredUser.userrole || [])
      .map((item) => item.role?.roleName)
      .filter(Boolean);
    const practitionerTypes = (registeredUser.user_practitioners || [])
      .map((item) => item.type)
      .filter(Boolean);

    let accountMatches = false;
    if (resolvedType === "Parents") {
      accountMatches =
        roleNames.includes("Parents") ||
        (registeredUser.user_parents || []).length > 0;
    } else if (resolvedType === "Doctor") {
      accountMatches = practitionerTypes.includes("Doctor");
    } else if (resolvedType === "Therapist") {
      accountMatches = practitionerTypes.includes("Therapist");
    }

    if (!accountMatches) {
      return {
        statusCode: 400,
        message: `This email is registered with Autibile, but not as a ${resolvedType} account. Please select the correct account type.`,
      };
    }

    const existingOpenRequest =
      await prisma.account_deletion_requests.findFirst({
        where: {
          deleted_at: null,
          status: { in: ["Pending", "In Progress"] },
          OR: [{ email }, { email: normalizedEmail }],
        },
        orderBy: { created_at: "desc" },
      });

    if (existingOpenRequest) {
      return {
        statusCode: 409,
        message: `A deletion request for this email is already being processed (reference #${existingOpenRequest.request_id}).`,
      };
    }

    const now = DateTime.now().toISO();

    const created = await prisma.account_deletion_requests.create({
      data: {
        full_name: fullName,
        email: registeredUser.userEmail || email,
        account_type: resolvedType,
        additional_info: additionalInfo || null,
        status: "Pending",
        created_at: now,
        updated_at: now,
      },
    });

    // Best-effort email notifications — request is already saved for admins
    try {
      let supportEmails = [];
      try {
        const techSupports = await prisma.tech_supports.findMany({
          where: {
            deleted_at: null,
            OR: [
              { techSupport_status: "ACTIVE" },
              { techSupport_status: "Active" },
            ],
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
        console.log("Unable to load tech supports for delete request:", e);
      }

      const destination =
        process.env.DELETE_ACCOUNT_EMAIL ||
        supportEmails[0] ||
        process.env.SMTP_FROM ||
        process.env.SMTP_USER;

      if (destination && process.env.SMTP_HOST) {
        const html = `
          <h2>Autibile account deletion request</h2>
          <p>A user requested deletion of their Autibile account and associated data.</p>
          <ul>
            <li><strong>Request ID:</strong> ${created.request_id}</li>
            <li><strong>Full name:</strong> ${escapeHtml(fullName)}</li>
            <li><strong>Account email:</strong> ${escapeHtml(email)}</li>
            <li><strong>Account type:</strong> ${escapeHtml(resolvedType)}</li>
            <li><strong>Additional information:</strong> ${escapeHtml(additionalInfo) || "—"}</li>
          </ul>
          <p>Review this request in the admin panel under <strong>Account Deletion Requests</strong>.</p>
        `;

        await sendEmail({
          to: destination,
          replyTo: email,
          subject: `[Autibile] Account deletion request #${created.request_id} — ${resolvedType}`,
          html,
        });

        try {
          await sendEmail({
            to: email,
            subject: "We received your Autibile account deletion request",
            html: `
              <p>Hi ${escapeHtml(fullName)},</p>
              <p>We received your request to delete your Autibile account associated with
              <strong>${escapeHtml(email)}</strong> (reference #${created.request_id}).</p>
              <p>Verified requests are processed within <strong>30 days</strong>.</p>
              <p>— Autibile Support</p>
            `,
          });
        } catch (ackError) {
          console.log("Failed to send deletion acknowledgement email:", ackError);
        }
      }
    } catch (emailError) {
      console.log("Failed to send deletion request notification email:", emailError);
    }

    return {
      statusCode: 200,
      message:
        "Your deletion request has been submitted. We will process verified requests within 30 days.",
      data: { requestId: created.request_id },
    };
  } catch (error) {
    console.log(error);
    return {
      statusCode: 500,
      message: "Server error while submitting your request.",
    };
  }
});

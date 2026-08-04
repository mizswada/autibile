import { DateTime } from "luxon";
import {
  ALLOWED_ACCOUNT_TYPES,
  REQUEST_TYPES,
  accountTypeMatchesUser,
  escapeHtml,
  findOpenAccountRequest,
  findRecentAccountRequest,
  findRegisteredUserByEmail,
  getAdminNotificationEmail,
  normalizePhone,
  sendAccountRequestEmail,
} from "~/server/utils/accountRequestHelpers";

export const TEMP_RESET_PASSWORD = "12345678";

function inferAccountType(registeredUser) {
  const roleNames = (registeredUser.userrole || [])
    .map((item) => item.role?.roleName)
    .filter(Boolean);
  const practitionerTypes = (registeredUser.user_practitioners || [])
    .map((item) => item.type)
    .filter(Boolean);

  const matches = ALLOWED_ACCOUNT_TYPES.filter((type) =>
    accountTypeMatchesUser(type, registeredUser),
  );

  if (matches.length === 1) return matches[0];
  if (roleNames.includes("Parents") || (registeredUser.user_parents || []).length > 0) {
    return "Parents";
  }
  if (practitionerTypes.includes("Doctor")) return "Doctor";
  if (practitionerTypes.includes("Therapist")) return "Therapist";
  return matches[0] || "";
}

export async function handleAccountRequestSubmit(body) {
  let requestType = (body?.requestType || body?.request_type || "").trim();
  const fullName = (body?.fullName || body?.full_name || "").trim();
  const email = (body?.email || "").trim();
  const phoneNumber = (body?.phoneNumber || body?.phone_number || "").trim();
  let accountType = (body?.accountType || body?.account_type || "").trim();
  const additionalInfo = (body?.additionalInfo || body?.additional_info || "").trim();
  const confirmed =
    body?.confirmed === true ||
    body?.confirmed === "true" ||
    body?.confirmed === 1;

  if (!requestType && confirmed !== undefined && fullName) {
    requestType = REQUEST_TYPES.ACCOUNT_DELETION;
  }

  if (!email) {
    return {
      statusCode: 400,
      message: "Email is required.",
    };
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    return {
      statusCode: 400,
      message: "Please provide a valid email address.",
    };
  }

  if (
    requestType !== REQUEST_TYPES.PASSWORD_RESET &&
    requestType !== REQUEST_TYPES.ACCOUNT_DELETION
  ) {
    return {
      statusCode: 400,
      message: "Invalid request type.",
    };
  }

  const registeredUser = await findRegisteredUserByEmail(email);

  if (!registeredUser) {
    return {
      statusCode: 404,
      message:
        "No Autibile account was found with this email. Please use the email you registered with.",
    };
  }

  if (!accountType) {
    accountType = inferAccountType(registeredUser);
  }

  if (requestType === REQUEST_TYPES.PASSWORD_RESET) {
    if (!phoneNumber) {
      return {
        statusCode: 400,
        message: "Phone number is required for password reset requests.",
      };
    }
  } else {
    if (!fullName) {
      return {
        statusCode: 400,
        message: "Full name is required.",
      };
    }
    if (!confirmed) {
      return {
        statusCode: 400,
        message: "Please confirm that you want to delete your account.",
      };
    }
  }

  if (!ALLOWED_ACCOUNT_TYPES.includes(accountType)) {
    return {
      statusCode: 400,
      message:
        "Unable to determine account type. Please select Parents, Doctor, or Therapist.",
    };
  }

  if (
    registeredUser.userStatus &&
    ["DELETED", "Deleted", "deleted", "Inactive", "INACTIVE"].includes(
      registeredUser.userStatus,
    )
  ) {
    return {
      statusCode: 400,
      message: "This Autibile account is not active.",
    };
  }

  if (!accountTypeMatchesUser(accountType, registeredUser)) {
    return {
      statusCode: 400,
      message: `This email is registered with Autibile, but not as a ${accountType} account. Please select the correct account type.`,
    };
  }

  if (requestType === REQUEST_TYPES.PASSWORD_RESET) {
    const storedPhone = normalizePhone(registeredUser.userPhone);
    const submittedPhone = normalizePhone(phoneNumber);
    if (!storedPhone || storedPhone !== submittedPhone) {
      return {
        statusCode: 400,
        message:
          "The phone number does not match our records. Please use the phone number registered with your account.",
      };
    }
  }

  const recentDuplicate = await findRecentAccountRequest({
    email,
    requestType,
  });
  if (recentDuplicate) {
    return {
      statusCode: 429,
      message:
        "A request was submitted recently. Please wait a few minutes before trying again.",
    };
  }

  const existingOpenRequest = await findOpenAccountRequest({
    email,
    requestType,
  });
  if (existingOpenRequest) {
    const label =
      requestType === REQUEST_TYPES.PASSWORD_RESET
        ? "password reset"
        : "account deletion";
    return {
      statusCode: 409,
      message: `A ${label} request for this email is already being processed (reference #${existingOpenRequest.request_id}).`,
    };
  }

  const now = DateTime.now().toISO();
  const resolvedName =
    fullName || registeredUser.userFullName || registeredUser.userUsername || email;

  const created = await prisma.account_deletion_requests.create({
    data: {
      request_type: requestType,
      full_name: resolvedName,
      email: registeredUser.userEmail || email,
      phone_number: phoneNumber || registeredUser.userPhone || null,
      user_id: registeredUser.userID,
      account_type: accountType,
      additional_info: additionalInfo || null,
      status: "Pending",
      created_at: now,
      updated_at: now,
    },
  });

  try {
    const destination = await getAdminNotificationEmail();
    if (destination) {
      const typeLabel =
        requestType === REQUEST_TYPES.PASSWORD_RESET
          ? "Password reset"
          : "Account deletion";

      const adminHtml = `
        <h2>Autibile ${typeLabel} request</h2>
        <p>A user submitted an account request from the app or website.</p>
        <ul>
          <li><strong>Request ID:</strong> ${created.request_id}</li>
          <li><strong>Type:</strong> ${escapeHtml(typeLabel)}</li>
          <li><strong>Full name:</strong> ${escapeHtml(resolvedName)}</li>
          <li><strong>Account email:</strong> ${escapeHtml(email)}</li>
          <li><strong>Phone:</strong> ${escapeHtml(phoneNumber || registeredUser.userPhone || "—")}</li>
          <li><strong>Account type:</strong> ${escapeHtml(accountType)}</li>
          <li><strong>Additional information:</strong> ${escapeHtml(additionalInfo) || "—"}</li>
        </ul>
        <p>Review this request in the admin panel under <strong>Account Requests</strong>.</p>
      `;

      await sendAccountRequestEmail({
        to: destination,
        replyTo: email,
        subject: `[Autibile] ${typeLabel} request #${created.request_id} — ${accountType}`,
        html: adminHtml,
      });

      const userAckHtml =
        requestType === REQUEST_TYPES.PASSWORD_RESET
          ? `
            <p>Hi ${escapeHtml(resolvedName)},</p>
            <p>We received your password reset request for <strong>${escapeHtml(email)}</strong> (reference #${created.request_id}).</p>
            <p>Once an administrator approves your request, your password will be reset to <strong>${TEMP_RESET_PASSWORD}</strong>. Please sign in and change your password afterwards.</p>
            <p>For faster assistance, you may call our technical support team.</p>
            <p>— Autibile Support</p>
          `
          : `
            <p>Hi ${escapeHtml(resolvedName)},</p>
            <p>We received your request to delete your Autibile account associated with
            <strong>${escapeHtml(email)}</strong> (reference #${created.request_id}).</p>
            <p>Verified requests are processed after administrator approval.</p>
            <p>— Autibile Support</p>
          `;

      await sendAccountRequestEmail({
        to: email,
        subject:
          requestType === REQUEST_TYPES.PASSWORD_RESET
            ? "We received your Autibile password reset request"
            : "We received your Autibile account deletion request",
        html: userAckHtml,
      });
    }
  } catch (emailError) {
    console.log("Failed to send account request notification email:", emailError);
  }

  return {
    statusCode: 200,
    message:
      requestType === REQUEST_TYPES.PASSWORD_RESET
        ? `Your password reset request has been submitted. Once approved, your password will be reset to ${TEMP_RESET_PASSWORD}.`
        : "Your account deletion request has been submitted. We will process verified requests after administrator approval.",
    data: { requestId: created.request_id },
  };
}

<script setup>
import { ref, onMounted } from "vue";

definePageMeta({
  title: "Pending Payment Approvals",
});

const { $swal } = useNuxtApp();

const loading = ref(true);
const error = ref("");
const payments = ref([]);
const rejectionReason = ref("");

const fetchPendingPayments = async () => {
  loading.value = true;
  error.value = "";
  try {
    const response = await $fetch("/api/payment/listPendingPayments");
    if (response.statusCode === 200) {
      payments.value = response.data || [];
    } else {
      error.value = response.message || "Failed to load pending payments";
    }
  } catch (err) {
    console.error(err);
    error.value = "Failed to load pending payments";
  } finally {
    loading.value = false;
  }
};

const approvePayment = async (payment) => {
  const result = await $swal.fire({
    title: "Confirm Payment Approval",
    html: `
      <div style="text-align:left; font-size:14px; line-height:1.7;">
        <p>Please verify the payment details carefully before approving:</p>
        <hr style="margin:8px 0;" />
        <p><strong>Patient:</strong> ${payment.user_patients?.fullname || "N/A"}</p>
        <p><strong>Invoice:</strong> INV-${String(payment.invoice_id).padStart(3, "0")}</p>
        <p><strong>Description:</strong> ${payment.invoice?.description || "N/A"}</p>
        <p><strong>Amount:</strong> RM ${formatPrice(payment.amount)}</p>
        <p><strong>Method:</strong> ${payment.method || "N/A"}</p>
        <p><strong>Bank / Provider:</strong> ${payment.bank_name || "-"}</p>
        <p><strong>Reference:</strong> ${payment.reference_code || "-"}</p>
        <hr style="margin:8px 0;" />
        <p style="color:#b45309;">Approving will mark this invoice as <strong>Paid</strong>, issue a receipt, and credit the package sessions to the patient. Only approve after you have confirmed the payment was actually received.</p>
      </div>
    `,
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#2E7D32",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, approve payment",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return;

  try {
    const response = await $fetch("/api/payment/approvePayment", {
      method: "PUT",
      body: { paymentID: payment.payment_id },
    });
    if (response.statusCode !== 200) {
      await $swal.fire("Error", response.message || "Failed to approve payment", "error");
      return;
    }
    await $swal.fire(
      "Payment Approved",
      "The invoice has been marked as paid and the patient's sessions have been credited.",
      "success"
    );
    await fetchPendingPayments();
  } catch (err) {
    console.error(err);
    await $swal.fire("Error", "Failed to approve payment", "error");
  }
};

const rejectPayment = async (paymentID) => {
  const reason = prompt("Optional rejection reason:", rejectionReason.value || "");
  const response = await $fetch("/api/payment/rejectPayment", {
    method: "PUT",
    body: { paymentID, reason: reason || null },
  });
  if (response.statusCode !== 200) {
    alert(response.message || "Failed to reject payment");
    return;
  }
  await fetchPendingPayments();
};

const formatPrice = (price) => Number(price || 0).toFixed(2);
const formatDate = (dateString) => new Date(dateString).toLocaleString("en-MY");

onMounted(fetchPendingPayments);
</script>

<template>
  <main>
    <LayoutsBreadcrumb />
    <rs-card class="p-6">
      <div class="flex justify-between items-center mb-5">
        <h5 class="text-xl font-semibold">Pending Payment Approvals</h5>
        <NuxtLink to="/payment">
          <rs-button variant="ghost">Back to Payment</rs-button>
        </NuxtLink>
      </div>

      <div v-if="loading" class="py-10 text-center">Loading pending payments...</div>
      <div v-else-if="error" class="py-10 text-center text-red-500">{{ error }}</div>
      <div v-else-if="payments.length === 0" class="py-10 text-center text-gray-500">
        No pending parent payments.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-200">
              <th class="text-left py-3 px-4">Patient</th>
              <th class="text-left py-3 px-4">Invoice</th>
              <th class="text-left py-3 px-4">Amount</th>
              <th class="text-left py-3 px-4">Method</th>
              <th class="text-left py-3 px-4">Bank</th>
              <th class="text-left py-3 px-4">Reference</th>
              <th class="text-left py-3 px-4">Submitted</th>
              <th class="text-left py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="payment in payments" :key="payment.payment_id" class="border-b border-gray-100">
              <td class="py-3 px-4">{{ payment.user_patients?.fullname || "N/A" }}</td>
              <td class="py-3 px-4">
                INV-{{ String(payment.invoice_id).padStart(3, "0") }}<br />
                <span class="text-xs text-gray-500">{{ payment.invoice?.description || "N/A" }}</span>
              </td>
              <td class="py-3 px-4">RM {{ formatPrice(payment.amount) }}</td>
              <td class="py-3 px-4">{{ payment.method || "N/A" }}</td>
              <td class="py-3 px-4">{{ payment.bank_name || "-" }}</td>
              <td class="py-3 px-4">{{ payment.reference_code || "-" }}</td>
              <td class="py-3 px-4">{{ formatDate(payment.created_at) }}</td>
              <td class="py-3 px-4">
                <div class="flex gap-2">
                  <rs-button size="sm" variant="success" @click="approvePayment(payment)">Approve</rs-button>
                  <rs-button size="sm" variant="danger" @click="rejectPayment(payment.payment_id)">Reject</rs-button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </rs-card>
  </main>
</template>

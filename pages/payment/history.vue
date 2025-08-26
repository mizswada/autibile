<script setup>
definePageMeta({
  title: "Payment History",
});

// Reactive data
const paymentHistory = ref([]);
const invoiceHistory = ref([]);
const loading = ref(false);
const error = ref('');

// Pagination
const currentPage = ref(1);
const itemsPerPage = ref(10);
const totalItems = ref(0);

// Filters
const searchQuery = ref('');
const statusFilter = ref('all');
const methodFilter = ref('all');
const dateRange = ref({
  startDate: '',
  endDate: ''
});

// UI state
const activeTab = ref('invoices');
const selectedInvoice = ref(null);
const showInvoiceDetails = ref(false);
const selectedPayment = ref(null);
const showPaymentDetails = ref(false);
const isGeneratingPdf = ref(false);
const isGeneratingAllPdf = ref(false);
const isGeneratingReceipt = ref(false);

// Fetch invoices from API
const fetchInvoices = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const params = new URLSearchParams({
      limit: itemsPerPage.value.toString(),
      offset: ((currentPage.value - 1) * itemsPerPage.value).toString(),
    });

    if (searchQuery.value) {
      params.append('search', searchQuery.value);
    }

    if (statusFilter.value !== 'all' && activeTab.value === 'invoices') {
      params.append('status', statusFilter.value);
    }

    if (dateRange.value.startDate) {
      params.append('startDate', dateRange.value.startDate);
    }

    if (dateRange.value.endDate) {
      params.append('endDate', dateRange.value.endDate);
    }

    const response = await $fetch(`/api/payment/listInvoices?${params}`);
    
    if (response.statusCode === 200) {
      invoiceHistory.value = response.data;
      totalItems.value = response.pagination.total;
    } else {
      error.value = response.message || 'Failed to fetch invoices';
    }
  } catch (err) {
    console.error('Error fetching invoices:', err);
    error.value = 'An error occurred while fetching invoices';
  } finally {
    loading.value = false;
  }
};

// Fetch payments from API
const fetchPayments = async () => {
  loading.value = true;
  error.value = '';
  
  try {
    const params = new URLSearchParams({
      limit: itemsPerPage.value.toString(),
      offset: ((currentPage.value - 1) * itemsPerPage.value).toString(),
    });

    if (searchQuery.value) {
      params.append('search', searchQuery.value);
    }

    // Note: Payment table doesn't have status field, so we skip status filtering for payments
    // if (statusFilter.value !== 'all') {
    //   params.append('status', statusFilter.value);
    // }

    if (methodFilter.value !== 'all') {
      params.append('method', methodFilter.value);
    }

    if (dateRange.value.startDate) {
      params.append('startDate', dateRange.value.startDate);
    }

    if (dateRange.value.endDate) {
      params.append('endDate', dateRange.value.endDate);
    }

    const response = await $fetch(`/api/payment/listPayments?${params}`);
    
    if (response.statusCode === 200) {
      paymentHistory.value = response.data;
      totalItems.value = response.pagination.total;
    } else {
      error.value = response.message || 'Failed to fetch payments';
    }
  } catch (err) {
    console.error('Error fetching payments:', err);
    error.value = 'An error occurred while fetching payments';
  } finally {
    loading.value = false;
  }
};

// Load data when tab changes
const loadData = () => {
  currentPage.value = 1;
  if (activeTab.value === 'invoices') {
    fetchInvoices();
  } else {
    fetchPayments();
  }
};

// Watch for tab changes
watch(activeTab, loadData);

// Watch for filter changes
watch([searchQuery, statusFilter, methodFilter, dateRange], () => {
  loadData();
}, { deep: true });

// Load initial data
onMounted(() => {
  loadData();
});

// Utility functions
const formatPrice = (price) => {
  if (!price) return '0.00';
  return parseFloat(price)
    .toFixed(2)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-MY', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const formatInvoiceId = (id) => {
  return `INV-${id.toString().padStart(3, '0')}`;
};

const formatPaymentId = (id) => {
  return `PAY-${id.toString().padStart(3, '0')}`;
};

const viewInvoiceDetails = (invoice) => {
  selectedInvoice.value = invoice;
  showInvoiceDetails.value = true;
};

const viewPaymentDetails = async (payment) => {
  try {
    const response = await $fetch(`/api/payment/getPayment/${payment.payment_id}`);
    if (response.statusCode === 200) {
      selectedPayment.value = response.data;
      showPaymentDetails.value = true;
    } else {
      alert('Failed to load payment details');
    }
  } catch (err) {
    console.error('Error fetching payment details:', err);
    alert('Error loading payment details');
  }
};

const closeDetails = () => {
  showInvoiceDetails.value = false;
  showPaymentDetails.value = false;
};

const downloadAllInvoices = async () => {
  try {
    if (invoiceHistory.value.length === 0) {
      alert('No invoices to download.');
      return;
    }

    isGeneratingAllPdf.value = true;

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('jspdf');
    
    // Create a PDF with A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    let currentPage = 1;
    let yPosition = 20;
    
    // Add header with company info on the left
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Autibile', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 10;
    
    // Company address on the left
    pdf.text('47150 Puchong, Selangor.', 20, yPosition);
    yPosition += 5;
    pdf.text('1 - 4, Prima Bizwalk Business Park', 20, yPosition);
    yPosition += 5;
    pdf.text('Jalan Tasik Prima 6/2', 20, yPosition);
    yPosition += 5;
    pdf.text('Taman Tasik Prima', 20, yPosition);
    yPosition += 15;
    
    // Title
    pdf.setFontSize(16);
    pdf.setFont(undefined, 'bold');
    pdf.text('INVOICE HISTORY REPORT', pageWidth / 2, yPosition, { align: 'center' });
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 10;
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;
    
    // Summary table
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('SUMMARY:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 8;
    
    const totalInvoices = invoiceHistory.value.length;
    const paidInvoices = invoiceHistory.value.filter(inv => inv.status === 'Paid').length;
    const unpaidInvoices = totalInvoices - paidInvoices;
    const totalAmount = invoiceHistory.value.reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    const paidAmount = invoiceHistory.value
      .filter(inv => inv.status === 'Paid')
      .reduce((sum, inv) => sum + parseFloat(inv.amount || 0), 0);
    
    pdf.text(`Total Invoices: ${totalInvoices}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Paid Invoices: ${paidInvoices}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Unpaid Invoices: ${unpaidInvoices}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Total Amount: RM ${formatPrice(totalAmount)}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Paid Amount: RM ${formatPrice(paidAmount)}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Outstanding Amount: RM ${formatPrice(totalAmount - paidAmount)}`, 20, yPosition);
    yPosition += 15;
    
    // Invoice details table
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('INVOICE DETAILS:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 8;
    
    // Table headers with proper column positioning
    const headers = ['Invoice No', 'Patient', 'Amount', 'Date', 'Status'];
    const colWidths = [30, 50, 25, 25, 20];
    const startX = 20;
    const colPositions = [startX + 5, startX + 35, startX + 85, startX + 110, startX + 135];
    
    pdf.setFont(undefined, 'bold');
    headers.forEach((header, index) => {
      pdf.text(header, colPositions[index], yPosition);
    });
    pdf.setFont(undefined, 'normal');
    yPosition += 5;
    
    // Table content
    for (const invoice of invoiceHistory.value) {
      // Check if we need a new page
      if (yPosition > pageHeight - 30) {
        pdf.addPage();
        currentPage++;
        yPosition = 20;
        
        // Repeat headers on new page
        pdf.setFont(undefined, 'bold');
        headers.forEach((header, index) => {
          pdf.text(header, colPositions[index], yPosition);
        });
        pdf.setFont(undefined, 'normal');
        yPosition += 5;
      }
      
      pdf.text(formatInvoiceId(invoice.invoice_id), colPositions[0], yPosition);
      
      // Truncate patient name if too long
      const patientName = invoice.patient_name.length > 15 ? 
        invoice.patient_name.substring(0, 12) + '...' : invoice.patient_name;
      pdf.text(patientName, colPositions[1], yPosition);
      
      pdf.text(`RM ${formatPrice(invoice.amount)}`, colPositions[2], yPosition);
      pdf.text(formatDate(invoice.date), colPositions[3], yPosition);
      pdf.text(invoice.status, colPositions[4], yPosition);
      
      yPosition += 5;
    }
    
    // Add page numbers
    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
    
    // Save the PDF with a formatted filename
    const filename = `Invoice_History_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    
    // Show success message
    alert('Invoice history report downloaded successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF: ' + (error.message || 'Unknown error'));
  } finally {
    isGeneratingAllPdf.value = false;
  }
};

const downloadInvoice = async (invoiceId) => {
  try {
    // Find the invoice data
    const invoice = invoiceHistory.value.find(inv => inv.invoice_id === invoiceId);
    if (!invoice) {
      alert('Invoice not found.');
      return;
    }

    isGeneratingPdf.value = true;

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('jspdf');
    
    // Create a PDF with A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add header with company info on the left
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Autibile', 20, 20);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    
    // Company address on the left
    pdf.text('47150 Puchong, Selangor.', 20, 30);
    pdf.text('1 - 4, Prima Bizwalk Business Park', 20, 35);
    pdf.text('Jalan Tasik Prima 6/2', 20, 40);
    pdf.text('Taman Tasik Prima', 20, 45);
    
    // Invoice details on the right
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('INVOICE', pageWidth - 20, 20, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    pdf.text(`Invoice No: ${formatInvoiceId(invoice.invoice_id)}`, pageWidth - 20, 30, { align: 'right' });
    pdf.text(`Date: ${formatDate(invoice.date)}`, pageWidth - 20, 35, { align: 'right' });
    pdf.text(`Due Date: ${formatDate(invoice.due_date)}`, pageWidth - 20, 40, { align: 'right' });
    pdf.text(`Status: ${invoice.status}`, pageWidth - 20, 45, { align: 'right' });
    
    // Bill to section
    let yPosition = 60;
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('BILL TO:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 8;
    pdf.text(`Patient: ${invoice.patient_name}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Patient ID: ${invoice.patient_id}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Invoice Type: ${invoice.invoice_type || 'N/A'}`, 20, yPosition);
    
    // Table
    yPosition += 15;
    
    // Define table column positions and widths
    const tableStartX = 20;
    const tableWidth = pageWidth - 40; // 170mm for A4
    const colWidths = [70, 25, 25, 15, 25]; // Description, Price, Discount, Qty, Amount
    const colPositions = [
      tableStartX + 5,           // Description: 25mm
      tableStartX + 75,          // Price: 75mm
      tableStartX + 100,         // Discount: 100mm
      tableStartX + 125,         // Qty: 125mm
      tableStartX + 140          // Amount: 140mm
    ];
    
    // Table headers
    pdf.setFont(undefined, 'bold');
    pdf.rect(tableStartX, yPosition - 5, tableWidth, 8);
    pdf.text('Description', colPositions[0], yPosition);
    pdf.text('Price', colPositions[1], yPosition);
    pdf.text('Discount', colPositions[2], yPosition);
    pdf.text('Qty', colPositions[3], yPosition);
    pdf.text('Amount', colPositions[4], yPosition);
    pdf.setFont(undefined, 'normal');
    
    // Table content
    yPosition += 8;
    pdf.rect(tableStartX, yPosition - 5, tableWidth, 8);
    
    // Truncate description if too long
    const description = invoice.description.length > 25 ? 
      invoice.description.substring(0, 22) + '...' : invoice.description;
    pdf.text(description, colPositions[0], yPosition);
    pdf.text(`RM ${formatPrice(invoice.amount)}`, colPositions[1], yPosition);
    pdf.text('RM 0.00', colPositions[2], yPosition);
    pdf.text('1', colPositions[3], yPosition);
    pdf.text(`RM ${formatPrice(invoice.amount)}`, colPositions[4], yPosition);
    
    // Summary section
    yPosition += 20;
    const summaryX = pageWidth - 60;
    const summaryWidth = 50;
    
    pdf.setFont(undefined, 'bold');
    pdf.text('SUMMARY', summaryX, yPosition);
    pdf.setFont(undefined, 'normal');
    yPosition += 8;
    
    // Summary rows
    pdf.text('Sub Total:', summaryX, yPosition);
    pdf.text(`RM ${formatPrice(invoice.amount)}`, summaryX + summaryWidth, yPosition, { align: 'right' });
    yPosition += 5;
    
    pdf.text('Tax (0%):', summaryX, yPosition);
    pdf.text('RM 0.00', summaryX + summaryWidth, yPosition, { align: 'right' });
    yPosition += 5;
    
    pdf.setFont(undefined, 'bold');
    pdf.text('Grand Total:', summaryX, yPosition);
    pdf.text(`RM ${formatPrice(invoice.amount)}`, summaryX + summaryWidth, yPosition, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    
    // Payment information if available
    if (invoice.payment_date || invoice.payment_method || invoice.payment_reference) {
      yPosition += 15;
      pdf.setFontSize(12);
      pdf.setFont(undefined, 'bold');
      pdf.text('PAYMENT INFORMATION:', 20, yPosition);
      pdf.setFont(undefined, 'normal');
      pdf.setFontSize(10);
      yPosition += 8;
      
      if (invoice.payment_date) {
        pdf.text(`Payment Date: ${formatDate(invoice.payment_date)}`, 20, yPosition);
        yPosition += 5;
      }
      if (invoice.payment_method) {
        pdf.text(`Payment Method: ${invoice.payment_method}`, 20, yPosition);
        yPosition += 5;
      }
      if (invoice.payment_reference) {
        pdf.text(`Reference: ${invoice.payment_reference}`, 20, yPosition);
        yPosition += 5;
      }
    }
    
    // Terms and conditions
    yPosition += 15;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('Terms and Conditions:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    yPosition += 5;
    pdf.setFontSize(8);
    pdf.text('1. Payment is due within 30 days of invoice date.', 20, yPosition);
    yPosition += 4;
    pdf.text('2. Late payments may incur additional charges.', 20, yPosition);
    yPosition += 4;
    pdf.text('3. This is a computer generated invoice.', 20, yPosition);
    yPosition += 4;
    pdf.text('4. Thank you for choosing Autibile.', 20, yPosition);
    
    // Footer
    pdf.setFontSize(8);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Save the PDF with a formatted filename
    const filename = `Invoice_${formatInvoiceId(invoice.invoice_id)}_${invoice.patient_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    
    // Show success message
    alert('Invoice PDF downloaded successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF: ' + (error.message || 'Unknown error'));
  } finally {
    isGeneratingPdf.value = false;
  }
};

const printInvoice = (invoice) => {
  if (!invoice) {
    alert('Invoice not found.');
    return;
  }

  const printContent = `
    <html>
    <head>
      <title>Invoice ${formatInvoiceId(invoice.invoice_id)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header, .footer { text-align: center; }
        .company-info { text-align: left; }
        .invoice-meta { text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; }
        .summary { margin-top: 30px; float: right; width: 300px; }
        .summary div { display: flex; justify-content: space-between; padding: 4px 0; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .terms { margin-top: 80px; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Autibile</h2>
        <div class="company-info">
          47150 Puchong, Selangor.<br>
          1 - 4, Prima Bizwalk Business Park<br>
          Jalan Tasik Prima 6/2<br>
          Taman Tasik Prima,
        </div>
        <br>
      </div>

      <div class="invoice-meta">
        <p>Invoice No ${formatInvoiceId(invoice.invoice_id)}</p>
        <p>Sales Date ${formatDate(invoice.date)}</p>
        <p>Issued Date ${new Date().toLocaleDateString()}</p>
      </div>

      <div>
        <h4>BILL TO</h4>
        <p>${invoice.patient_name}</p>
        <p>${invoice.description}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Price</th>
            <th>Discount</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${invoice.description}</td>
            <td>${formatPrice(invoice.amount)}</td>
            <td>0.00</td>
            <td>1</td>
            <td>${formatPrice(invoice.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div><span>Sub Total</span><span>${formatPrice(invoice.amount)}</span></div>
        <div><span>Grand Total</span><span>${formatPrice(invoice.amount)}</span></div>
        <div><span>Online</span><span>${formatPrice(invoice.amount)}</span></div>
      </div>

      <div class="signature">
        <div><strong>Signature:</strong></div>
        <div><strong>REMARK:</strong></div>
      </div>

      <div class="terms">
        <p><strong>Terms and Conditions</strong></p>
        <p>Thank you.<br>This is computer generated receipt no signature required.</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'height=800,width=800');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

const downloadReceipt = async (paymentId) => {
  try {
    // Find the payment data
    const payment = paymentHistory.value.find(pay => pay.payment_id === paymentId);
    if (!payment) {
      alert('Payment not found.');
      return;
    }

    isGeneratingReceipt.value = true;

    // Import jsPDF dynamically
    const { default: jsPDF } = await import('jspdf');
    
    // Create a PDF with A4 dimensions
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add header with company info on the left
    pdf.setFontSize(18);
    pdf.setFont(undefined, 'bold');
    pdf.text('Autibile', 20, 20);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    
    // Company address on the left
    pdf.text('47150 Puchong, Selangor.', 20, 30);
    pdf.text('1 - 4, Prima Bizwalk Business Park', 20, 35);
    pdf.text('Jalan Tasik Prima 6/2', 20, 40);
    pdf.text('Taman Tasik Prima', 20, 45);
    
    // Receipt details on the right
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('RECEIPT', pageWidth - 20, 20, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    pdf.text(`Receipt No: ${formatPaymentId(payment.payment_id)}`, pageWidth - 20, 30, { align: 'right' });
    pdf.text(`Date: ${formatDate(payment.created_at)}`, pageWidth - 20, 35, { align: 'right' });
    pdf.text(`Status: Completed`, pageWidth - 20, 40, { align: 'right' });
    
    // Bill to section
    let yPosition = 60;
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('PAID BY:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 8;
    pdf.text(`Patient: ${payment.patient_name}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Patient ID: ${payment.patient_id}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Invoice Type: ${payment.invoice_type || 'N/A'}`, 20, yPosition);
    
    // Table
    yPosition += 15;
    
    // Define table column positions and widths
    const tableStartX = 20;
    const tableWidth = pageWidth - 40; // 170mm for A4
    const colWidths = [70, 25, 25, 15, 25]; // Description, Price, Discount, Qty, Amount
    const colPositions = [
      tableStartX + 5,           // Description: 25mm
      tableStartX + 75,          // Price: 75mm
      tableStartX + 100,         // Discount: 100mm
      tableStartX + 125,         // Qty: 125mm
      tableStartX + 140          // Amount: 140mm
    ];
    
    // Table headers
    pdf.setFont(undefined, 'bold');
    pdf.rect(tableStartX, yPosition - 5, tableWidth, 8);
    pdf.text('Description', colPositions[0], yPosition);
    pdf.text('Price', colPositions[1], yPosition);
    pdf.text('Discount', colPositions[2], yPosition);
    pdf.text('Qty', colPositions[3], yPosition);
    pdf.text('Amount', colPositions[4], yPosition);
    pdf.setFont(undefined, 'normal');
    
    // Table content
    yPosition += 8;
    pdf.rect(tableStartX, yPosition - 5, tableWidth, 8);
    
    // Truncate description if too long
    const description = payment.invoice_description.length > 25 ? 
      payment.invoice_description.substring(0, 22) + '...' : payment.invoice_description;
    pdf.text(description, colPositions[0], yPosition);
    pdf.text(`RM ${formatPrice(payment.amount)}`, colPositions[1], yPosition);
    pdf.text('RM 0.00', colPositions[2], yPosition);
    pdf.text('1', colPositions[3], yPosition);
    pdf.text(`RM ${formatPrice(payment.amount)}`, colPositions[4], yPosition);
    
    // Summary section
    yPosition += 20;
    const summaryX = pageWidth - 60;
    const summaryWidth = 50;
    
    pdf.setFont(undefined, 'bold');
    pdf.text('SUMMARY', summaryX, yPosition);
    pdf.setFont(undefined, 'normal');
    yPosition += 8;
    
    // Summary rows
    pdf.text('Sub Total:', summaryX, yPosition);
    pdf.text(`RM ${formatPrice(payment.amount)}`, summaryX + summaryWidth, yPosition, { align: 'right' });
    yPosition += 5;
    
    pdf.text('Tax (0%):', summaryX, yPosition);
    pdf.text('RM 0.00', summaryX + summaryWidth, yPosition, { align: 'right' });
    yPosition += 5;
    
    pdf.setFont(undefined, 'bold');
    pdf.text('Grand Total:', summaryX, yPosition);
    pdf.text(`RM ${formatPrice(payment.amount)}`, summaryX + summaryWidth, yPosition, { align: 'right' });
    pdf.setFont(undefined, 'normal');
    
    // Payment information
    yPosition += 15;
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('PAYMENT INFORMATION:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    pdf.setFontSize(10);
    yPosition += 8;
    
    pdf.text(`Payment Date: ${formatDate(payment.created_at)}`, 20, yPosition);
    yPosition += 5;
    pdf.text(`Payment Method: ${payment.method}`, 20, yPosition);
    yPosition += 5;
    if (payment.bank_name) {
      pdf.text(`Bank Name: ${payment.bank_name}`, 20, yPosition);
      yPosition += 5;
    }
    if (payment.reference_code) {
      pdf.text(`Reference: ${payment.reference_code}`, 20, yPosition);
      yPosition += 5;
    }
    
    // Terms and conditions
    yPosition += 15;
    pdf.setFontSize(10);
    pdf.setFont(undefined, 'bold');
    pdf.text('Terms and Conditions:', 20, yPosition);
    pdf.setFont(undefined, 'normal');
    yPosition += 5;
    pdf.setFontSize(8);
    pdf.text('1. This receipt confirms successful payment.', 20, yPosition);
    yPosition += 4;
    pdf.text('2. Please keep this receipt for your records.', 20, yPosition);
    yPosition += 4;
    pdf.text('3. This is a computer generated receipt.', 20, yPosition);
    yPosition += 4;
    pdf.text('4. Thank you for choosing Autibile.', 20, yPosition);
    
    // Footer
    pdf.setFontSize(8);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    
    // Save the PDF with a formatted filename
    const filename = `Receipt_${formatPaymentId(payment.payment_id)}_${payment.patient_name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    pdf.save(filename);
    
    // Show success message
    alert('Receipt PDF downloaded successfully!');
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('Error generating PDF: ' + (error.message || 'Unknown error'));
  } finally {
    isGeneratingReceipt.value = false;
  }
};

const printReceipt = (payment) => {
  if (!payment) {
    alert('Payment not found.');
    return;
  }

  const printContent = `
    <html>
    <head>
      <title>Receipt ${formatPaymentId(payment.payment_id)}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; }
        .header, .footer { text-align: center; }
        .company-info { text-align: left; }
        .receipt-meta { text-align: right; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; }
        th { background-color: #f2f2f2; }
        .summary { margin-top: 30px; float: right; width: 300px; }
        .summary div { display: flex; justify-content: space-between; padding: 4px 0; }
        .signature { margin-top: 60px; display: flex; justify-content: space-between; }
        .terms { margin-top: 80px; font-size: 12px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>Autibile</h2>
        <div class="company-info">
          47150 Puchong, Selangor.<br>
          1 - 4, Prima Bizwalk Business Park<br>
          Jalan Tasik Prima 6/2<br>
          Taman Tasik Prima,
        </div>
        <br>
      </div>

      <div class="receipt-meta">
        <p>Receipt No ${formatPaymentId(payment.payment_id)}</p>
        <p>Payment Date ${formatDate(payment.created_at)}</p>
        <p>Issued Date ${new Date().toLocaleDateString()}</p>
      </div>

      <div>
        <h4>PAID BY</h4>
        <p>${payment.patient_name}</p>
        <p>${payment.invoice_description}</p>
      </div>

      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Price</th>
            <th>Discount</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${payment.invoice_description}</td>
            <td>${formatPrice(payment.amount)}</td>
            <td>0.00</td>
            <td>1</td>
            <td>${formatPrice(payment.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="summary">
        <div><span>Sub Total</span><span>${formatPrice(payment.amount)}</span></div>
        <div><span>Grand Total</span><span>${formatPrice(payment.amount)}</span></div>
        <div><span>${payment.method}</span><span>${formatPrice(payment.amount)}</span></div>
      </div>

      <div class="signature">
        <div><strong>Signature:</strong></div>
        <div><strong>REMARK:</strong></div>
      </div>

      <div class="terms">
        <p><strong>Terms and Conditions</strong></p>
        <p>Thank you.<br>This is computer generated receipt no signature required.</p>
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '', 'height=800,width=800');
  printWindow.document.write(printContent);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  printWindow.close();
};

// Pagination functions
const nextPage = () => {
  if (currentPage.value * itemsPerPage.value < totalItems.value) {
    currentPage.value++;
    loadData();
  }
};

const prevPage = () => {
  if (currentPage.value > 1) {
    currentPage.value--;
    loadData();
  }
};

const goToPage = (page) => {
  currentPage.value = page;
  loadData();
};

// Computed properties for pagination
const totalPages = computed(() => {
  return Math.ceil(totalItems.value / itemsPerPage.value);
});

const pageNumbers = computed(() => {
  const pages = [];
  const maxPages = 5;
  let start = Math.max(1, currentPage.value - Math.floor(maxPages / 2));
  let end = Math.min(totalPages.value, start + maxPages - 1);
  
  if (end - start + 1 < maxPages) {
    start = Math.max(1, end - maxPages + 1);
  }
  
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }
  
  return pages;
});
</script>

<template>
  <div>
    <LayoutsBreadcrumb />

    <rs-card>
      <template #header>
        <div class="flex justify-between items-center">
          <h5 class="mb-0">Payment History</h5>
          <div class="flex space-x-2">
            <rs-button 
              v-if="activeTab === 'invoices' && invoiceHistory.length > 0"
              variant="primary" 
              @click="downloadAllInvoices"
              :loading="isGeneratingAllPdf"
              :disabled="isGeneratingAllPdf"
            >
              <NuxtIcon name="ic:outline-download" class="mr-1" />
              {{ isGeneratingAllPdf ? 'Generating PDF...' : 'Download All Invoices' }}
            </rs-button>
            <NuxtLink to="/payment">
              <rs-button variant="outline">
                <NuxtIcon name="ic:outline-payment" class="mr-1" />
                Make a Payment
              </rs-button>
            </NuxtLink>
          </div>
        </div>
      </template>
      
      <!-- Tabs -->
      <div class="border-b border-[rgb(var(--border-color))]">
        <div class="flex">
          <button 
            class="py-3 px-6 border-b-2 font-medium text-sm"
            :class="activeTab === 'invoices' ? 'border-primary text-primary' : 'border-transparent hover:border-gray-300'"
            @click="activeTab = 'invoices'"
          >
            Invoices
          </button>
          <button 
            class="py-3 px-6 border-b-2 font-medium text-sm"
            :class="activeTab === 'payments' ? 'border-primary text-primary' : 'border-transparent hover:border-gray-300'"
            @click="activeTab = 'payments'"
          >
            Payments
          </button>
        </div>
      </div>
      
      <!-- Search and Filter -->
      <div class="p-4 bg-[rgb(var(--bg-2))]">
        <div class="flex flex-col md:flex-row gap-4">
          <div class="flex-1">
            <FormKit
              type="text"
              :placeholder="activeTab === 'invoices' ? 'Search by description or patient name' : 'Search by reference or description'"
              v-model="searchQuery"
              outer-class="mb-0"
              prefix-icon="search"
            />
          </div>
          <div class="w-full md:w-48">
            <FormKit
              type="select"
              placeholder="Filter by status"
              v-model="statusFilter"
              :options="activeTab === 'invoices' ? [
                { label: 'All', value: 'all' },
                { label: 'Paid', value: 'Paid' },
                { label: 'Unpaid', value: 'Unpaid' }
              ] : [
                { label: 'All', value: 'all' }
              ]"
              outer-class="mb-0"
            />
          </div>
          <div v-if="activeTab === 'payments'" class="w-full md:w-48">
            <FormKit
              type="select"
              placeholder="Filter by method"
              v-model="methodFilter"
              :options="[
                { label: 'All', value: 'all' },
                { label: 'Online Banking', value: 'Online Banking' },
                { label: 'Credit Card', value: 'Credit Card' },
                { label: 'E-Wallet', value: 'E-Wallet' }
              ]"
              outer-class="mb-0"
            />
          </div>
          <div class="w-full md:w-48">
            <FormKit
              type="date"
              placeholder="Start Date"
              v-model="dateRange.startDate"
              outer-class="mb-0"
            />
          </div>
          <div class="w-full md:w-48">
            <FormKit
              type="date"
              placeholder="End Date"
              v-model="dateRange.endDate"
              outer-class="mb-0"
            />
          </div>
        </div>
      </div>
      
      <!-- Invoices Tab -->
      <div v-if="activeTab === 'invoices'" class="p-4">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p class="text-gray-500">Loading invoices...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
          <NuxtIcon name="ic:outline-error" class="text-6xl mb-4 text-red-400" />
          <p class="text-red-500 mb-4">{{ error }}</p>
          <rs-button @click="loadData" variant="outline">Retry</rs-button>
        </div>

        <!-- Empty State -->
        <div v-else-if="invoiceHistory.length === 0" class="text-center py-8">
          <NuxtIcon name="ic:outline-receipt" class="text-6xl mb-4 text-gray-400" />
          <p class="text-gray-500">No invoices found matching your criteria</p>
        </div>
        
        <!-- Data Table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[rgb(var(--border-color))]">
            <thead>
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Invoice ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Patient</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Description</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Issue Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Due Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[rgb(var(--border-color))]">
              <tr v-for="invoice in invoiceHistory" :key="invoice.invoice_id" class="hover:bg-[rgb(var(--bg-2))]">
                <td class="px-6 py-4 whitespace-nowrap">{{ formatInvoiceId(invoice.invoice_id) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ invoice.patient_name }}</td>
                <td class="px-6 py-4">{{ invoice.description }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(invoice.date) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(invoice.due_date) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">RM {{ formatPrice(invoice.amount) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <rs-badge :variant="invoice.status === 'Paid' ? 'success' : 'warning'">
                    {{ invoice.status }}
                  </rs-badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex space-x-2">
                    <rs-button variant="text" @click="viewInvoiceDetails(invoice)">
                      <Icon name="mdi:eye" />
                    </rs-button>
                    <rs-button 
                      variant="text" 
                      @click="downloadInvoice(invoice.invoice_id)"
                      :loading="isGeneratingPdf"
                      :disabled="isGeneratingPdf"
                    >
                      <Icon name="mdi:download" />
                    </rs-button>
                    <rs-button variant="text" @click="printInvoice(invoice)">
                      <Icon name="mdi:printer" />
                    </rs-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, totalItems) }} of {{ totalItems }} results
            </div>
            <div class="flex items-center space-x-2">
              <rs-button 
                variant="outline" 
                size="sm" 
                @click="prevPage" 
                :disabled="currentPage === 1"
              >
                Previous
              </rs-button>
              
              <div class="flex space-x-1">
                <rs-button 
                  v-for="page in pageNumbers" 
                  :key="page"
                  variant="outline" 
                  size="sm" 
                  @click="goToPage(page)"
                  :class="page === currentPage ? 'bg-primary text-white' : ''"
                >
                  {{ page }}
                </rs-button>
              </div>
              
              <rs-button 
                variant="outline" 
                size="sm" 
                @click="nextPage" 
                :disabled="currentPage === totalPages"
              >
                Next
              </rs-button>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Payments Tab -->
      <div v-if="activeTab === 'payments'" class="p-4">
        <!-- Loading State -->
        <div v-if="loading" class="text-center py-8">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p class="text-gray-500">Loading payments...</p>
        </div>

        <!-- Error State -->
        <div v-else-if="error" class="text-center py-8">
          <NuxtIcon name="ic:outline-error" class="text-6xl mb-4 text-red-400" />
          <p class="text-red-500 mb-4">{{ error }}</p>
          <rs-button @click="loadData" variant="outline">Retry</rs-button>
        </div>

        <!-- Empty State -->
        <div v-else-if="paymentHistory.length === 0" class="text-center py-8">
          <NuxtIcon name="ic:outline-credit-card" class="text-6xl mb-4 text-gray-400" />
          <p class="text-gray-500">No payments found matching your criteria</p>
        </div>
        
        <!-- Data Table -->
        <div v-else class="overflow-x-auto">
          <table class="min-w-full divide-y divide-[rgb(var(--border-color))]">
            <thead>
              <tr>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Payment ID</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Patient</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Invoice</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Date</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Amount</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Status</th>
                <th class="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-[rgb(var(--border-color))]">
              <tr v-for="payment in paymentHistory" :key="payment.payment_id" class="hover:bg-[rgb(var(--bg-2))]">
                <td class="px-6 py-4 whitespace-nowrap">{{ formatPaymentId(payment.payment_id) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">{{ payment.patient_name }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div class="font-medium">{{ formatInvoiceId(payment.invoice_id) }}</div>
                    <div class="text-sm text-gray-500">{{ payment.invoice_description }}</div>
                  </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">{{ formatDate(payment.created_at) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">RM {{ formatPrice(payment.amount) }}</td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <rs-badge variant="success">
                    Completed
                  </rs-badge>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                  <div class="flex space-x-2">
                    <rs-button variant="text" size="sm" @click="viewPaymentDetails(payment)">
                      <Icon name="ic:outline-visibility" />
                    </rs-button>
                    <rs-button 
                      variant="text" 
                      size="sm"
                      @click="downloadReceipt(payment.payment_id)"
                      :loading="isGeneratingReceipt"
                      :disabled="isGeneratingReceipt"
                    >
                      <Icon name="mdi:download" />
                    </rs-button>
                    <rs-button variant="text" size="sm" @click="printReceipt(payment)">
                      <Icon name="mdi:printer" />
                    </rs-button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="mt-6 flex items-center justify-between">
            <div class="text-sm text-gray-500">
              Showing {{ (currentPage - 1) * itemsPerPage + 1 }} to {{ Math.min(currentPage * itemsPerPage, totalItems) }} of {{ totalItems }} results
            </div>
            <div class="flex items-center space-x-2">
              <rs-button 
                variant="outline" 
                size="sm" 
                @click="prevPage" 
                :disabled="currentPage === 1"
              >
                Previous
              </rs-button>
              
              <div class="flex space-x-1">
                <rs-button 
                  v-for="page in pageNumbers" 
                  :key="page"
                  variant="outline" 
                  size="sm" 
                  @click="goToPage(page)"
                  :class="page === currentPage ? 'bg-primary text-white' : ''"
                >
                  {{ page }}
                </rs-button>
              </div>
              
              <rs-button 
                variant="outline" 
                size="sm" 
                @click="nextPage" 
                :disabled="currentPage === totalPages"
              >
                Next
              </rs-button>
            </div>
          </div>
        </div>
      </div>
    </rs-card>
    
    <!-- Invoice Details Modal -->
    <rs-modal v-model="showInvoiceDetails" title="Invoice Details">
      <div v-if="selectedInvoice" class="p-4">
        <div class="flex justify-between items-center mb-6">
          <h5>Invoice {{ formatInvoiceId(selectedInvoice.invoice_id) }}</h5>
          <rs-badge :variant="selectedInvoice.status === 'Paid' ? 'success' : 'warning'">
            {{ selectedInvoice.status }}
          </rs-badge>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-gray-500">Patient</p>
            <p class="font-medium">{{ selectedInvoice.patient_name }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Invoice Type</p>
            <p class="font-medium">{{ selectedInvoice.invoice_type || 'N/A' }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Issue Date</p>
            <p class="font-medium">{{ formatDate(selectedInvoice.date) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Due Date</p>
            <p class="font-medium">{{ formatDate(selectedInvoice.due_date) }}</p>
          </div>
          <div class="md:col-span-2">
            <p class="text-sm text-gray-500">Description</p>
            <p class="font-medium">{{ selectedInvoice.description }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Amount</p>
            <p class="font-medium">RM {{ formatPrice(selectedInvoice.amount) }}</p>
          </div>
          <div v-if="selectedInvoice.status === 'Paid' && selectedInvoice.payment_date">
            <p class="text-sm text-gray-500">Payment Date</p>
            <p class="font-medium">{{ formatDate(selectedInvoice.payment_date) }}</p>
          </div>
          <div v-if="selectedInvoice.payment_method">
            <p class="text-sm text-gray-500">Payment Method</p>
            <p class="font-medium">{{ selectedInvoice.payment_method }}</p>
          </div>
          <div v-if="selectedInvoice.payment_reference">
            <p class="text-sm text-gray-500">Payment Reference</p>
            <p class="font-medium">{{ selectedInvoice.payment_reference }}</p>
          </div>
        </div>
        
        <!-- <div class="flex justify-end space-x-2">
          <rs-button variant="outline" @click="downloadInvoice(selectedInvoice.invoice_id)">
            <NuxtIcon name="ic:outline-download" class="mr-1" />
            Download
          </rs-button>
          <rs-button variant="outline" @click="printInvoice(selectedInvoice)">
            <NuxtIcon name="ic:outline-print" class="mr-1" />
            Print
          </rs-button>
          <rs-button @click="closeDetails">Close</rs-button>
        </div> -->
      </div>
    </rs-modal>
    
    <!-- Payment Details Modal -->
    <rs-modal v-model="showPaymentDetails" title="Payment Details">
      <div v-if="selectedPayment" class="p-4">
        <div class="flex justify-between items-center mb-6">
          <h5>Payment {{ formatPaymentId(selectedPayment.payment_id) }}</h5>
          <rs-badge variant="success">
            Completed
          </rs-badge>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <p class="text-sm text-gray-500">Patient</p>
            <p class="font-medium">{{ selectedPayment.patient_name }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Invoice ID</p>
            <p class="font-medium">{{ formatInvoiceId(selectedPayment.invoice_id) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Invoice Description</p>
            <p class="font-medium">{{ selectedPayment.invoice_description }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Payment Date</p>
            <p class="font-medium">{{ formatDate(selectedPayment.created_at) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Amount</p>
            <p class="font-medium">RM {{ formatPrice(selectedPayment.amount) }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Payment Method</p>
            <p class="font-medium">{{ selectedPayment.method }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Bank Name</p>
            <p class="font-medium">{{ selectedPayment.bank_name || 'N/A' }}</p>
          </div>
          <div>
            <p class="text-sm text-gray-500">Reference Number</p>
            <p class="font-medium">{{ selectedPayment.reference_code }}</p>
          </div>
          <div v-if="selectedPayment.invoice_type">
            <p class="text-sm text-gray-500">Invoice Type</p>
            <p class="font-medium">{{ selectedPayment.invoice_type }}</p>
          </div>
          <div v-if="selectedPayment.patient_available_sessions !== undefined">
            <p class="text-sm text-gray-500">Available Sessions</p>
            <p class="font-medium">{{ selectedPayment.patient_available_sessions }}</p>
          </div>
        </div>
        
        <!-- <div class="flex justify-end">
          <rs-button @click="closeDetails">Close</rs-button>
        </div> -->
      </div>
    </rs-modal>
  </div>
</template> 
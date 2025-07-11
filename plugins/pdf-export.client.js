// This plugin registers jsPDF and html2canvas for PDF export
// It's a client-only plugin since it uses browser APIs

export default defineNuxtPlugin(async (nuxtApp) => {
  // Only import these libraries on the client side
  if (process.client) {
    try {
      const jsPDFModule = await import('jspdf');
      const html2canvasModule = await import('html2canvas');
      
      // Make them available globally
      nuxtApp.provide('jsPDF', jsPDFModule.default);
      nuxtApp.provide('html2canvas', html2canvasModule.default);
      
      console.log('PDF export capabilities loaded');
    } catch (error) {
      console.error('Failed to load PDF export libraries:', error);
    }
  }
}); 
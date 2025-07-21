export default defineNuxtRouteMiddleware(async (to, from) => {
  const { $swal } = useNuxtApp();
  const userStore = useUserStore();

  // Skip middleware if not on client side
  if (process.server) {
    return;
  }

  // Get user roles from store
  const userRoles = userStore.roles || [];
  
  // Define role-based access rules
  const accessRules = {
    // Admin-only pages
    admin: [
      '/questionnaire',
      '/communitySupport',
      '/faq',
      '/autismCentre',
      '/userManagement',
      '/payment',
      '/therapyService',
      '/techSupport',
      '/devtool'
    ],
    // Doctor-allowed pages
    doctor: [
      '/dashboard',
      '/appointmentManagement',
      '/diaryReport',
      '/patientProfile'
    ]
  };

  // Check if user is admin
  const isAdmin = userRoles.some(role => 
    role.includes('Admin') || role.includes('Administrator')
  );
  
  // Check if user is doctor
  const isDoctor = userRoles.some(role => 
    role.includes('Practitioners') || role.includes('Doctor')
  );

  // Get current path
  const currentPath = to.path;

  // If user is admin, allow access to all pages
  if (isAdmin) {
    return;
  }

  // If user is doctor, check access rules
  if (isDoctor) {
    // Check if trying to access admin-only pages
    const isAccessingAdminPage = accessRules.admin.some(adminPath => 
      currentPath.startsWith(adminPath)
    );

    if (isAccessingAdminPage) {
      $swal.fire({
        title: "Access Denied",
        text: "You don't have permission to access this page. Only administrators can access this feature.",
        icon: "error",
        confirmButtonText: "OK",
      });
      
      // Redirect to dashboard
      return navigateTo('/dashboard');
    }
    
    // Check if accessing doctor-allowed pages
    const isAccessingDoctorPage = accessRules.doctor.some(doctorPath => 
      currentPath.startsWith(doctorPath)
    );

    // Allow access to doctor pages and dashboard
    if (isAccessingDoctorPage || currentPath === '/dashboard') {
      return;
    }

    // For any other pages, redirect to dashboard
    return navigateTo('/dashboard');
  }

  // If user has no recognized role, redirect to login
  if (!isAdmin && !isDoctor) {
    $swal.fire({
      title: "Access Denied",
      text: "You don't have permission to access this application. Please contact your administrator.",
      icon: "error",
      confirmButtonText: "OK",
    });
    
    return navigateTo('/logout');
  }
}); 
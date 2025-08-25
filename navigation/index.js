// Navigation configuration with role-based access
const adminNavigation = [
  {
    child: [
      {
        title: "Dashboard",
        path: "/dashboard",
        icon: "ic:outline-dashboard",
        child: [],
      },
    ],
  },
  {
    // header: "Apps & Pages",
    // description: "Wonderful apps",
    child: [
      {
        title: "Autism Screening",
        icon: "material-symbols:quiz-outline",
        path: "/questionnaire",
        children: [
          {
            title: "Manage Autism Screening",
            path: "/questionnaire",
          },
          {
            title: "View Responses",
            path: "/questionnaire/results",
          },
          {
            title: "Take Autism Screening",
            path: "/questionnaire",
            click: (router) => {
              // This will be handled in the questionnaire index page
              // User will select which questionnaire to take
              router.push('/questionnaire');
            }
          },
        ],
      },
      {
        title: "Appointment",
        icon: "ic:outline-calendar-today",
        path: "/appointmentManagement/newAppointment/scheduledAppointment",
      },
      {
        title: "Posting",
        icon: "ic:outline-headset-mic",
        path: "/communitySupport/postManagement",
      },
     
      {
        title: "FAQ",
        icon: "ic:outline-question-answer",
        path: "/faq",
      },
      {
        title: "Therapy Centre",
        icon:"ic:outline-home",
        path: "/autismCentre",
      },
      {
        title: "Manage User",
        icon: "ic:outline-person",
        child: [
          {
            title: "Parents Management",
            icon: "ic:outline-person",
            child: [
              {
                title: "Parents",
                path: "/userManagement/parent/parents",
              },
              {
                title: "Manage Child",
                path: "/userManagement/parent/manageChild",
              },
            ],
          },
          {
            title: "Practitioners Management",
            path: "/userManagement/practitioners",
          },
          {
            title: "Admin Management",
            path: "/userManagement/admin/adminPage",
          },
          {
            title: "Users Approval",
            path: "/userManagement/userApproval",
          },
        ],
      },
      {
        title: "Payment",
        icon: "ic:outline-payment",
        child: [
          {
            title: "Make Payment",
            path: "/payment",
          },
          {
            title: "Payment History",
            path: "/payment/history",
          }
        ],
      },
      {
        title: "Therapy Service Management",
        icon: "ic:outline-emoji-people",
        path: "/therapyService",
      },
      {
        title: "Diary Report",
        icon: "ic:outline-pie-chart",
        path: "/diaryReport",
      },
      {
        title: "Patient Profile",
        icon: "material-symbols:person",
        path: "/patientProfile/select",
      },
      {
        title: "Tech Support",
        icon: "ic:outline-headset-mic",
        path: "/techSupport",
      },
    ],
  },
];

const doctorNavigation = [
  {
    child: [
      {
        title: "Dashboard",
        path: "/dashboard",
        icon: "ic:outline-dashboard",
        child: [],
      },
    ],
  },
  {
    child: [
      {
        title: "Appointment",
        icon: "ic:outline-calendar-today",
        path: "/appointmentManagement/newAppointment/scheduledAppointment",
      },
      {
        title: "Diary Report",
        icon: "ic:outline-pie-chart",
        path: "/diaryReport",
      },
      {
        title: "Patient Profile",
        icon: "material-symbols:person",
        path: "/patientProfile/select",
      },
      {
        title: "Tech Support",
        icon: "ic:outline-headset-mic",
        path: "/techSupport",
      },
    ],
  },
];

// Function to get navigation based on user roles
export function getNavigationByRole(userRoles = []) {
  // Check if user has admin role
  const isAdmin = userRoles.some(role => 
    role.includes('Admin') || role.includes('Administrator')
  );
  
  // Check if user is a doctor (Practitioners role with Doctor type)
  const isDoctor = userRoles.some(role => 
    role.includes('Practitioners') || role.includes('Doctor')
  );
  
  if (isAdmin) {
    return adminNavigation;
  } else if (isDoctor) {
    return doctorNavigation;
  }
  
  // Default to admin navigation if no specific role is found
  return adminNavigation;
}

// Export default navigation (for backward compatibility)
export default adminNavigation;

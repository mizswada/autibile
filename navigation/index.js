export default [
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
    header: "Apps & Pages",
    description: "Wonderful apps",
    child: [
      // Commented by: Firzana Huda 25 June 2025
      // {
      //   title: "Pages",
      //   icon: "ic:outline-insert-drive-file",
      //   child: [
      //     {
      //       title: "Authentication",
      //       child: [
      //         {
      //           title: "Login V1",
      //           path: "/auth/login-v1",
      //         },
      //         {
      //           title: "Login V2",
      //           path: "/auth/login-v2",
      //         },
      //         {
      //           title: "Register V1",
      //           path: "/auth/register-v1",
      //         },
      //         {
      //           title: "Register V2",
      //           path: "/auth/register-v2",
      //         },
      //         {
      //           title: "Forgot Password V1",
      //           path: "/auth/forgot-password-v1",
      //         },
      //         {
      //           title: "Forgot Password V2",
      //           path: "/auth/forgot-password-v2",
      //         },
      //         {
      //           title: "Reset Password V1",
      //           path: "/auth/reset-password-v1",
      //         },
      //         {
      //           title: "Reset Password V2",
      //           path: "/auth/reset-password-v2",
      //         },
      //       ],
      //     },
      //     {
      //       title: "Error 404",
      //       path: "/error/404",
      //     },
      //     {
      //       title: "Error 500",
      //       path: "/error/500",
      //     },
      //   ],
      // },

      {
        title: "User Management",
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
        title: "Appointment Management",
        icon: "ic:outline-calendar-today",
        child: [
          // {
          //   title: "New Appointment",
          //   path: "/appointmentManagement/newAppointment",
          // },
          {
            title: "Scheduled Appointment",
            path: "/appointmentManagement/newAppointment/scheduledAppointment",
          },
        ],
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
        title: "Manage Autism Centre",
        icon:"ic:outline-home",
        path: "/autismCentre",
      },

       {
        title: "Manage Questionnaire",
        icon: "material-symbols:quiz-outline",
        path: "/questionnaire",
        children: [
          {
            title: "Manage Questionnaires",
            path: "/questionnaire",
          },
          {
            title: "View Responses",
            path: "/questionnaire/results",
          },
          {
            title: "Take Questionnaire",
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
        title: "Manage FAQ",
        icon: "ic:outline-question-answer",
        path: "/faq",
      },
      {
        title: "Community Support",
        icon: "ic:outline-headset-mic",
        child: [
          {
            title: "Posts Management",
            path: "/communitySupport/postManagement",
          },
          {
            title: "Reported Posts",
            path: "/communitySupport/reportedContent",
          },
        ],
      },
       {
        title: "Therapy Service Management",
        icon: "ic:outline-emoji-people",
        path: "/therapyService",
      },
      // {
      //   title: "Profile",
      //   icon: "ic:outline-person",
      //   child: [
      //     {
      //       title: "Profile Edit",
      //       path: "/profile/profileEdit",
      //     },
      //   ],
      // },
      {
        title: "Tech Support",
        icon: "ic:outline-headset-mic",
        path: "/techSupport",
      },
    ],
    
  },

];

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
      {
        title: "Pages",
        icon: "ic:outline-insert-drive-file",
        child: [
          {
            title: "Authentication",
            child: [
              {
                title: "Login V1",
                path: "/auth/login-v1",
              },
              {
                title: "Login V2",
                path: "/auth/login-v2",
              },
              {
                title: "Register V1",
                path: "/auth/register-v1",
              },
              {
                title: "Register V2",
                path: "/auth/register-v2",
              },
              {
                title: "Forgot Password V1",
                path: "/auth/forgot-password-v1",
              },
              {
                title: "Forgot Password V2",
                path: "/auth/forgot-password-v2",
              },
              {
                title: "Reset Password V1",
                path: "/auth/reset-password-v1",
              },
              {
                title: "Reset Password V2",
                path: "/auth/reset-password-v2",
              },
            ],
          },
          {
            title: "Error 404",
            path: "/error/404",
          },
          {
            title: "Error 500",
            path: "/error/500",
          },
        ],
      },

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
            title: "Doctors",
            path: "/userManagement/doctor",
          },
          {
            title: "Therapists",
            path: "/userManagement/therapist",
          },
          {
            title: "Users Approval",
            path: "/userManagement/userApproval",
          },
        ],
      },

      {
        title: "Appointment Management",
        icon: "ic:outline-calendar-today",
        child: [
          {
            title: "New Appointment",
            path: "/appointmentManagement/newAppointment",
          },
          {
            title: "Scheduled Appointment",
            path: "/appointmentManagement/scheduledAppointment",
          },
        ],
      },

       {
        title: "Reports",
        icon: "ic:outline-pie-chart",
        path: "/reports",
      },

      {
        title: "Manage Autism Centre",
        icon:"ic:outline-home",
        path: "/autismCentre",
      },

       {
        title: "Manage Questionnaire",
        icon: "ic:outline-question-answer",
        path: "/questionnaire",
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
        title: "Therapy Plan Management",
        icon: "ic:outline-emoji-people",
        path: "/therapyAndActivity",
      },
      {
        title: "Profile",
        icon: "ic:outline-person",
        child: [
          {
            title: "Profile Edit",
            path: "/profile/profileEdit",
          },
        ],
      },
      {
        title: "Tech Support",
        icon: "ic:outline-headset-mic",
        path: "/technicalSupport",
      },
    ],
    
  },

];

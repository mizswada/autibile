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
    // header: "Apps & Pages",
    // description: "Wonderful apps",
    child: [
      {
        title: "Questionnaires",
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
        title: "Appointment",
        icon: "ic:outline-calendar-today",
        child: [
          {
            title: "Scheduled Appointment",
            path: "/appointmentManagement/newAppointment/scheduledAppointment",
          },
        ],
      },
      {
        title: "Posting",
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

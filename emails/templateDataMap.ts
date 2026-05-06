import type { CourseEnrolledEmailProps } from "./CourseEnrolledEmail";
import type { EmailVerificationOtpEmailProps } from "./EmailVerificationOtpEmail";
import type { NewLaunchEmailProps } from "./NewLaunchEmail";
import { PreviewProps as newLaunchPreviewProps } from "./NewLaunchEmail";
import type { NewCourseAddedEmailProps } from "./NewCourseAddedEmail";
import type { ResetPasswordEmailProps } from "./ResetPasswordEmail";
import type { WelcomeEmailProps } from "./WelcomeEmail";

export type TemplatePropsBySlug = {
  welcome: WelcomeEmailProps;
  resetPassword: ResetPasswordEmailProps;
  courseEnrolled: CourseEnrolledEmailProps;
  newCourseAdded: NewCourseAddedEmailProps;
  emailVerificationOtp: EmailVerificationOtpEmailProps;
  newLaunch: NewLaunchEmailProps;
};

export type TemplateSlug = keyof TemplatePropsBySlug;

export const templateDataMap: {
  [K in TemplateSlug]: { defaultData: TemplatePropsBySlug[K] };
} = {
  welcome: {
    defaultData: {
      name: "Nexgen Learner",
      loginUrl: "https://example.com/login",
    },
  },
  resetPassword: {
    defaultData: {
      name: "Nexgen Learner",
      resetCode: "924318",
      expiresInMinutes: 10,
    },
  },
  courseEnrolled: {
    defaultData: {
      name: "Nexgen Learner",
      courseTitle: "Node.js Bootcamp",
      instructorName: "Jane Instructor",
      courseUrl: "https://example.com/courses/nodejs-bootcamp",
    },
  },
  newCourseAdded: {
    defaultData: {
      name: "Nexgen Learner",
      courseTitle: "Advanced Express Architecture",
      instructorName: "John Mentor",
      courseUrl: "https://example.com/courses/advanced-express-architecture",
    },
  },
  emailVerificationOtp: {
    defaultData: {
      name: "Nexgen Learner",
      otpCode: "583741",
      expiresInMinutes: 10,
    },
  },
  newLaunch: {
    defaultData: newLaunchPreviewProps,
  },
};

export type TemplateDefaultDataBySlug = {
  [K in TemplateSlug]: (typeof templateDataMap)[K]["defaultData"];
};

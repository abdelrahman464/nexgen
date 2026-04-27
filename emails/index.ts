import type { ComponentType } from "react";
import { CourseEnrolledEmail } from "./CourseEnrolledEmail";
import { EmailVerificationOtpEmail } from "./EmailVerificationOtpEmail";
import { NewLaunchEmail } from "./NewLaunchEmail";
import { NewCourseAddedEmail } from "./NewCourseAddedEmail";
import { ResetPasswordEmail } from "./ResetPasswordEmail";
import { WelcomeEmail } from "./WelcomeEmail";
import type { TemplatePropsBySlug, TemplateSlug } from "./templateDataMap";

type TemplateComponentMap = {
  [K in TemplateSlug]: ComponentType<TemplatePropsBySlug[K]>;
};

export const templates: TemplateComponentMap = {
  welcome: WelcomeEmail,
  resetPassword: ResetPasswordEmail,
  courseEnrolled: CourseEnrolledEmail,
  newCourseAdded: NewCourseAddedEmail,
  emailVerificationOtp: EmailVerificationOtpEmail,
  newLaunch: NewLaunchEmail,
};

export const templateSubjects: Record<TemplateSlug, string> = {
  welcome: "Welcome to Nexgen Academy",
  resetPassword: "Your Password Reset Code (valid for 10 minutes)",
  courseEnrolled: "Course Enrollment Confirmation",
  newCourseAdded: "New Course Added",
  emailVerificationOtp: "Your Email Verification Code (valid for 10 minutes)",
  newLaunch: "إعلان إطلاق جديد",
};

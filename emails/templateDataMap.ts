import type { CourseEnrolledEmailProps } from "./CourseEnrolledEmail";
import type { EmailVerificationOtpEmailProps } from "./EmailVerificationOtpEmail";
import type { NewLaunchEmailProps } from "./NewLaunchEmail";
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

export const templateDataMap: { [K in TemplateSlug]: { defaultData: TemplatePropsBySlug[K] } } = {
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
    defaultData: {
      launchType: "course",
      pageTitle: "كورس تحليل الرسم البياني — NexGen Academy",
      preheader:
        "دورة جديدة على NexGen Academy: تحليل الرسم البياني بخطة واضحة. خصم 25٪ لفترة محدودة بكود NEXGEN25.",
      topBarLabel: "إعلان كورس جديد",
      eyebrowLabel: "دورة جديدة • متاحة الآن",
      title: "هل بتفتح صفقات وبتخسر بدون ما تفهم السبب؟",
      subtitle: "المشكلة غالباً مش في السوق… بل في طريقة تحليلك.",
      introText:
        "لو عندك أساسيات التداول لكن لسه بتدخل صفقات بدون خطة واضحة، فالمشكلة مش في السوق — المشكلة في قراءة الشارت.",
      rating: "4.9",
      reviewCountText: "(46 تقييم)",
      levelLabel: "متوسط",
      accessDurationLabel: "مدى الحياة",
      certificateLabel: "معتمدة",
      launchUrl: "https://nexgen-academy.com/ar/courses/mastering-technical-analysis",
      launchUrlText: "احصل على الخصم وابدأ الآن",
      heroImageUrl: "assets/hero-banner.png",
      logoUrl: "assets/nexgen-logo.png",
      learnSectionTitle: "ماذا ستتعلم في كورس محلل رسم بياني؟",
      learnSectionIntro: "تركّز الدورة على المهارات التي تحتاجها لتحليل الشارت واتخاذ قرارات أوضح:",
      learnItems: [
        { index: "01", title: "فهم حركة السعر", description: "تفهم السوق بدل الاعتماد على إشارات عشوائية." },
        { index: "02", title: "تحديد الدخول والخروج", description: "تحدد نقاط الدخول والخروج بدقة أعلى." },
        { index: "03", title: "بناء استراتيجية تداول", description: "تبني نظام تداول واضح وقابل للتطبيق." },
      ],
      promoLabel: "عرض خاص للمسجَّلين",
      promoTitle: "خصم 25٪ لفترة محدودة",
      promoText: "عرض خاص للمسجّلين — استخدم الكود للحصول على خصم فوري.",
      promoCode: "NEXGEN25",
      promoFooterText: "ينتهي خلال 48 ساعة • استخدمه الآن قبل انتهاء العرض",
      finalCtaTitle: "ابدأ رحلة احتراف التداول اليوم",
      finalCtaText:
        "لا تُضِع مزيداً من الوقت في المحاولات العشوائية — انضم إلى من أتقن قراءة الأسواق المالية بمنهجية واضحة.",
      finalCtaButtonText: "اشترك الآن بخصم 25٪",
      browseAllText: "جميع الدورات",
      browseAllUrl: "https://nexgen-academy.com/ar/courses",
      footerTagline: "أكاديمية متخصّصة في تعليم التداول والتحليل الفني للأسواق المالية.",
      contactEmail: "[email protected]",
      websiteUrl: "https://nexgen-academy.com",
      privacyUrl: "https://nexgen-academy.com/ar/privacy",
      termsUrl: "https://nexgen-academy.com/ar/terms",
      unsubscribeUrl: "{{unsubscribe_url}}",
      disclaimer:
        "هذه الرسالة جزء من اشتراكك في NexGen Academy. التداول في الأسواق المالية ينطوي على مخاطر، والمحتوى المُقدَّم لأغراض تعليمية فقط ولا يُعدّ نصيحة استثمارية.",
      copyrightText: "© 2026 NexGen Academy. جميع الحقوق محفوظة.",
    },
  },
};

export type TemplateDefaultDataBySlug = {
  [K in TemplateSlug]: (typeof templateDataMap)[K]["defaultData"];
};

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
        "دورة جديدة على NexGen Academy: تحليل الرسم البياني — احترف قراءة الأسواق المالية. خصم 10% للمسجّلين بكود NEXGEN10.",
      topBarLabel: "إعلان كورس جديد",
      eyebrowLabel: "دورة جديدة • متاحة الآن",
      title: "تحليل الرسم البياني",
      subtitle: "احترف قراءة الأسواق المالية — من الصفر وحتى بناء استراتيجية تداول قابلة للتطبيق.",
      introText:
        "هل تبحث عن أفضل كورس تحليل فني يمنحك القدرة على فهم حركة السعر بدقة؟ النجاح في التداول يبدأ من إتقان الرسوم البيانية. انضم الآن إلى كورس محلل رسم بياني الشامل من NexGen Academy، المصمَّم خصيصاً لنقلك من البداية وحتى الاحتراف في قراءة الأسواق المالية.",
      rating: "4.9",
      reviewCountText: "(46 تقييم)",
      levelLabel: "متوسط",
      accessDurationLabel: "مدى الحياة",
      certificateLabel: "معتمدة",
      launchUrl: "https://nexgen-academy.com/ar/courses/mastering-technical-analysis",
      launchUrlText: "سجّل الآن في الكورس",
      heroImageUrl: "assets/hero-banner.png",
      logoUrl: "assets/nexgen-logo.png",
      learnSectionTitle: "ماذا ستتعلم في كورس محلل رسم بياني؟",
      learnSectionIntro:
        "صُمِّمت هذه الدورة لتكون دورة تعليم تداول احترافية تركّز على الجانب التطبيقي الذي يحتاجه المتداول يومياً:",
      learnItems: [
        { index: "01", title: "تعلّم التداول من الصفر", description: "فهم أساسيات الأسواق المالية وخطوات الدخول الأولى للمبتدئين بثقة." },
        { index: "02", title: "الشموع اليابانية", description: "احتراف قراءة نماذج الشموع وتوقُّع انعكاسات السعر القوية." },
        { index: "03", title: "الدعم والمقاومة", description: "تحديد مناطق السيولة وفهم تحليل هيكل السوق (Market Structure) بدقة." },
        { index: "04", title: "استراتيجيات البرايس أكشن", description: "التداول باحترافية عبر فهم سلوك السعر المباشر بعيداً عن تشتُّت المؤشرات." },
        { index: "05", title: "مناطق العرض والطلب", description: "كشف تمركزات السيولة الضخمة للبنوك والمؤسسات المالية الكبرى." },
      ],
      practicalSectionTitle: "التطبيق العملي وإدارة المخاطر",
      practicalSectionText:
        "المعرفة النظرية لا تكفي، لذا يتضمّن الكورس شرح منصة TradingView بالتفصيل، بدءاً من رسم الترند وصولاً إلى استخدام الأدوات الاحترافية. كما نضع تركيزاً مكثّفاً على إدارة المخاطر في التداول لضمان حماية رأس مالك والاستدامة في هذا المجال.",
      audienceSectionTitle: "لمن هذه الدورة؟",
      audienceItems: [
        "لمن يمتلك أساسيات الفوركس ويريد تعلّم التحليل الفني بشكل منهجي.",
        "للمتداول الذي يفتح صفقات لكن بدون خطة واضحة.",
        "لمن يريد فهم الرسم البياني بدل الاعتماد على الإشارات.",
        "لكل من يسعى لبناء أسلوب تداول احترافي وقابل للتطبيق.",
      ],
      perksSectionTitle: "مميزات الانضمام إلى NexGen Academy",
      perksItems: [
        { title: "منهج مكثّف", description: "يركّز على «خلاصة التجربة» وما يحقّق نتائج فعّالة." },
        { title: "شهادة معتمدة", description: "شهادة محلل فني فور إتمام الدورة بنجاح." },
        { title: "تطبيقات حيّة", description: "تشمل تحليل الذهب اليومي وأسهم الأسواق العالمية." },
      ],
      promoLabel: "عرض خاص للمسجَّلين",
      promoTitle: "خصم 10% لأنك جزء من العائلة",
      promoText:
        "لأنك مسجّل بالفعل في NexGen Academy، استخدم الكود التالي عند الدفع للحصول على خصم فوري على سعر الكورس.",
      promoCode: "NEXGEN10",
      promoFooterText: "العرض ساري لفترة محدودة • قابل للاستخدام مرة واحدة لكل حساب",
      finalCtaTitle: "ابدأ رحلة احتراف التداول اليوم",
      finalCtaText:
        "لا تُضِع مزيداً من الوقت في المحاولات العشوائية — انضم إلى من أتقن قراءة الأسواق المالية بمنهجية واضحة.",
      finalCtaButtonText: "اشترك الآن في الكورس",
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

import {
  Column,
  Heading,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";
import { Button } from "./components/Button";
import { EmailLayout } from "./components/EmailLayout";
import { EmailSection } from "./components/EmailSection";
import { Eyebrow } from "./components/Eyebrow";
import { FeatureList } from "./components/FeatureList";
import { MetaCard } from "./components/MetaCard";
import { PromoCodeBlock } from "./components/PromoCodeBlock";

export type LaunchType = "course" | "service" | "coursePackage";

export type LaunchFeature = {
  index: string;
  title: string;
  description: string;
};

/** Primary CTA: course checkout with coupon (+ UTM via `withUtm`). */
const LAUNCH_EMAIL_CTA =
  "https://nexgen-academy.com/ar/courses/mastering-technical-analysis?coupon=NEXGEN25";

const DEFAULT_BROWSE_COURSES = "https://nexgen-academy.com/ar/courses";

export type NewLaunchEmailProps = {
  launchType: LaunchType;
  pageTitle: string;
  preheader: string;
  topBarLabel: string;
  eyebrowLabel: string;
  title: string;
  subtitle: string;
  introText: string;
  rating: string;
  reviewCountText: string;
  levelLabel: string;
  accessDurationLabel: string;
  certificateLabel: string;
  launchUrl: string;
  launchUrlText: string;
  heroImageUrl: string;
  logoUrl: string;
  learnSectionTitle: string;
  learnSectionIntro: string;
  learnItems: LaunchFeature[];
  promoLabel: string;
  promoTitle: string;
  promoText: string;
  promoCode: string;
  promoFooterText: string;
  finalCtaTitle: string;
  finalCtaText: string;
  finalCtaButtonText: string;
  browseAllText: string;
  browseAllUrl: string;
  footerTagline: string;
  contactEmail: string;
  websiteUrl: string;
  privacyUrl: string;
  termsUrl: string;
  unsubscribeUrl: string;
  disclaimer: string;
  copyrightText: string;
};

export const PreviewProps: NewLaunchEmailProps = {
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
  launchUrl: LAUNCH_EMAIL_CTA,
  launchUrlText: "احصل على الخصم وابدأ الآن",
  heroImageUrl: "https://nexgen-academy.com/images/graph-course-image.png",
  logoUrl: "assets/nexgen-logo.png",
  learnSectionTitle: "ماذا ستتعلم في كورس محلل رسم بياني؟",
  learnSectionIntro:
    "تركّز الدورة على المهارات التي تحتاجها لتحليل الشارت واتخاذ قرارات أوضح:",
  learnItems: [
    {
      index: "01",
      title: "فهم حركة السعر",
      description: "تفهم السوق بدل الاعتماد على إشارات عشوائية.",
    },
    {
      index: "02",
      title: "تحديد الدخول والخروج",
      description: "تحدد نقاط الدخول والخروج بدقة أعلى.",
    },
    {
      index: "03",
      title: "بناء استراتيجية تداول",
      description: "تبني نظام تداول واضح وقابل للتطبيق.",
    },
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
  browseAllUrl: DEFAULT_BROWSE_COURSES,
  footerTagline:
    "أكاديمية متخصّصة في تعليم التداول والتحليل الفني للأسواق المالية.",
  contactEmail: "[email protected]",
  websiteUrl: "https://nexgen-academy.com",
  privacyUrl: "https://nexgen-academy.com/ar/privacy",
  termsUrl: "https://nexgen-academy.com/ar/terms",
  unsubscribeUrl: "{{unsubscribe_url}}",
  disclaimer:
    "هذه الرسالة جزء من اشتراكك في NexGen Academy. التداول في الأسواق المالية ينطوي على مخاطر، والمحتوى المُقدَّم لأغراض تعليمية فقط ولا يُعدّ نصيحة استثمارية.",
  copyrightText: "© 2026 NexGen Academy. جميع الحقوق محفوظة.",
};

export function NewLaunchEmail(props: NewLaunchEmailProps) {
  const ctaUrl = withUtm(LAUNCH_EMAIL_CTA);
  const browseCoursesUrl = withUtm(props.browseAllUrl || DEFAULT_BROWSE_COURSES);
  const websiteUrl = withUtm(props.websiteUrl);
  const privacyUrl = withUtm(props.privacyUrl);
  const termsUrl = withUtm(props.termsUrl);

  return (
    <EmailLayout
      preview={props.preheader}
      dir="rtl"
      topBarLabel={props.topBarLabel}
      showTopBarLabel
      logoUrl={props.logoUrl}
      footerTagline={props.footerTagline}
      websiteUrl={websiteUrl}
      contactEmail={props.contactEmail}
      privacyUrl={privacyUrl}
      termsUrl={termsUrl}
      unsubscribeUrl={props.unsubscribeUrl}
      disclaimer={`${props.disclaimer} ${props.copyrightText}`}
    >
      <Section style={heroWrap}>
        <Img
          src={props.heroImageUrl}
          alt={props.pageTitle}
          width="536"
          height="300"
          style={heroImage}
        />
      </Section>

      <EmailSection align="right">
        <Eyebrow>{props.eyebrowLabel}</Eyebrow>
        <Heading as="h1" style={h1}>
          {props.title}
        </Heading>
        <Text style={subhead}>{props.subtitle}</Text>
        <Text style={rating}>
          {props.rating} <span style={stars}>★★★★★</span>{" "}
          <span style={ratingMeta}>{props.reviewCountText}</span>
        </Text>
      </EmailSection>

      <EmailSection align="right" compact>
        <Text style={bodyText}>{props.introText}</Text>
      </EmailSection>

      <EmailSection compact>
        <Row>
          <Column width="33.33%" style={metaCol}>
            <MetaCard label="المستوى" value={props.levelLabel} />
          </Column>
          <Column width="33.33%" style={metaCol}>
            <MetaCard label="مدة الوصول" value={props.accessDurationLabel} />
          </Column>
          <Column width="33.33%" style={metaCol}>
            <MetaCard label="الشهادة" value={props.certificateLabel} />
          </Column>
        </Row>
      </EmailSection>

      <EmailSection align="center">
        <Button href={ctaUrl}>{props.launchUrlText}</Button>
      </EmailSection>

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.learnSectionTitle}
        </Heading>
        <Text style={bodyText}>{props.learnSectionIntro}</Text>
        <FeatureList items={props.learnItems} />
      </EmailSection>

      <EmailSection>
        <PromoCodeBlock
          label={props.promoLabel}
          title={props.promoTitle}
          description={props.promoText}
          code={props.promoCode}
          codeHref={ctaUrl}
          footerText={props.promoFooterText}
        />
      </EmailSection>

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.finalCtaTitle}
        </Heading>
        <Text style={bodyText}>{props.finalCtaText}</Text>
      </EmailSection>

      <EmailSection align="center">
        <Button href={ctaUrl} width={300}>
          {props.finalCtaButtonText}
        </Button>
        <Text style={browseRow}>
          أو تصفّح{" "}
          <Link href={browseCoursesUrl} style={browseLink}>
            {props.browseAllText}
          </Link>
        </Text>
      </EmailSection>
    </EmailLayout>
  );
}

(
  NewLaunchEmail as typeof NewLaunchEmail & {
    PreviewProps: NewLaunchEmailProps;
  }
).PreviewProps = PreviewProps;

export default NewLaunchEmail;

function withUtm(url: string) {
  if (!url || url.startsWith("{{")) {
    return url;
  }

  try {
    const trackedUrl = new URL(url);

    trackedUrl.searchParams.set("utm_source", "email");
    trackedUrl.searchParams.set("utm_campaign", "offer25");

    return trackedUrl.toString();
  } catch {
    const [baseUrl, hash = ""] = url.split("#");
    const separator = baseUrl.includes("?") ? "&" : "?";
    const hashSuffix = hash ? `#${hash}` : "";

    return `${baseUrl}${separator}utm_source=email&utm_campaign=offer25${hashSuffix}`;
  }
}

const heroWrap = { paddingBottom: "8px" };
const heroImage: React.CSSProperties = {
  width: "100%",
  maxWidth: "536px",
  borderRadius: "8px",
  display: "block",
  objectFit: "cover",
};
const h1 = {
  margin: "0 0 14px 0",
  fontSize: "30px",
  lineHeight: "1.35",
  fontWeight: 800,
  color: "#0b1f3a",
};
const h2 = {
  margin: "0 0 10px 0",
  fontSize: "22px",
  lineHeight: "1.4",
  fontWeight: 800,
  color: "#0b1f3a",
};
const subhead = {
  margin: "0 0 14px 0",
  fontSize: "17px",
  lineHeight: "1.9",
  fontWeight: 500,
  color: "#3a4a64",
};
const bodyText = {
  margin: 0,
  fontSize: "15px",
  lineHeight: "1.95",
  color: "#3a4a64",
};
const rating = {
  margin: 0,
  fontSize: "14px",
  fontWeight: 700,
  color: "#0b1f3a",
};
const stars = { color: "#f5b301", letterSpacing: "1px", margin: "0 8px" };
const ratingMeta = { fontWeight: 400, color: "#7b879b", fontSize: "13px" };
const metaCol = { padding: "0 4px" };
const browseRow = { marginTop: "14px", fontSize: "12.5px", color: "#7b879b" };
const browseLink = {
  color: "#1e7ff6",
  textDecoration: "none",
  fontWeight: 700,
};

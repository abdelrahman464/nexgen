import { Column, Heading, Img, Link, Row, Section, Text } from "@react-email/components";
import * as React from "react";
import { Button } from "./components/Button";
import { Divider } from "./components/Divider";
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
  practicalSectionTitle: string;
  practicalSectionText: string;
  audienceSectionTitle: string;
  audienceItems: string[];
  perksSectionTitle: string;
  perksItems: Array<{ title: string; description: string }>;
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
  finalCtaText: "لا تُضِع مزيداً من الوقت في المحاولات العشوائية — انضم إلى من أتقن قراءة الأسواق المالية بمنهجية واضحة.",
  finalCtaButtonText: "اشترك الآن في الكورس",
  browseAllText: "جميع الدورات",
  browseAllUrl: "https://nexgen-academy.com/ar/courses",
  footerTagline: "أكاديمية متخصّصة في تعليم التداول والتحليل الفني للأسواق المالية.",
  contactEmail: "[email protected]",
  websiteUrl: "https://nexgen-academy.com",
  privacyUrl: "https://nexgen-academy.com/ar/privacy",
  termsUrl: "https://nexgen-academy.com/ar/terms",
  unsubscribeUrl: "{{unsubscribe_url}}",
  disclaimer: "هذه الرسالة جزء من اشتراكك في NexGen Academy. التداول في الأسواق المالية ينطوي على مخاطر، والمحتوى المُقدَّم لأغراض تعليمية فقط ولا يُعدّ نصيحة استثمارية.",
  copyrightText: "© 2026 NexGen Academy. جميع الحقوق محفوظة.",
};

export function NewLaunchEmail(props: NewLaunchEmailProps) {
  const perksTop = props.perksItems.slice(0, 2);
  const perkBottom = props.perksItems[2];

  return (
    <EmailLayout
      preview={props.preheader}
      dir="rtl"
      topBarLabel={props.topBarLabel}
      showTopBarLabel
      logoUrl={props.logoUrl}
      footerTagline={props.footerTagline}
      websiteUrl={props.websiteUrl}
      contactEmail={props.contactEmail}
      privacyUrl={props.privacyUrl}
      termsUrl={props.termsUrl}
      unsubscribeUrl={props.unsubscribeUrl}
      disclaimer={`${props.disclaimer} ${props.copyrightText}`}
    >
      <Section style={heroWrap}>
        <Link href={props.launchUrl}>
          <Img src={props.heroImageUrl} alt={props.pageTitle} width="536" style={heroImage} />
        </Link>
      </Section>

      <EmailSection align="right">
        <Eyebrow>{props.eyebrowLabel}</Eyebrow>
        <Heading as="h1" style={h1}>
          {props.title}
        </Heading>
        <Text style={subhead}>{props.subtitle}</Text>
        <Text style={rating}>
          {props.rating} <span style={stars}>★★★★★</span> <span style={ratingMeta}>{props.reviewCountText}</span>
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
        <Button href={props.launchUrl}>{props.launchUrlText} ←</Button>
      </EmailSection>

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.learnSectionTitle}
        </Heading>
        <Text style={bodyText}>{props.learnSectionIntro}</Text>
        <FeatureList items={props.learnItems} />
      </EmailSection>

      <Divider />

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.practicalSectionTitle}
        </Heading>
        <Text style={bodyText}>{props.practicalSectionText}</Text>
      </EmailSection>

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.audienceSectionTitle}
        </Heading>
        {props.audienceItems.map((item) => (
          <Text key={item} style={audienceItem}>
            ✓ {item}
          </Text>
        ))}
      </EmailSection>

      <EmailSection align="right">
        <Heading as="h2" style={h2}>
          {props.perksSectionTitle}
        </Heading>
        <Row>
          <Column width="50%" style={perksColLeft}>
            <Card title={perksTop[0]?.title} description={perksTop[0]?.description} />
          </Column>
          <Column width="50%" style={perksColRight}>
            <Card title={perksTop[1]?.title} description={perksTop[1]?.description} />
          </Column>
        </Row>
        <Section style={perkBottomWrap}>
          <Card title={perkBottom?.title} description={perkBottom?.description} />
        </Section>
      </EmailSection>

      <EmailSection>
        <PromoCodeBlock
          label={props.promoLabel}
          title={props.promoTitle}
          description={props.promoText}
          code={props.promoCode}
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
        <Button href={props.launchUrl} width={300}>
          {props.finalCtaButtonText} ←
        </Button>
        <Text style={browseRow}>
          أو تصفّح{" "}
          <Link href={props.browseAllUrl} style={browseLink}>
            {props.browseAllText}
          </Link>
        </Text>
      </EmailSection>
    </EmailLayout>
  );
}

export default NewLaunchEmail;

function Card({ title, description }: { title?: string; description?: string }) {
  return (
    <Section style={card}>
      <Text style={cardTitle}>{title || ""}</Text>
      <Text style={cardBody}>{description || ""}</Text>
    </Section>
  );
}

const heroWrap = { paddingBottom: "8px" };
const heroImage = { width: "100%", maxWidth: "536px", borderRadius: "8px" };
const h1 = { margin: "0 0 14px 0", fontSize: "30px", lineHeight: "1.35", fontWeight: 800, color: "#0b1f3a" };
const h2 = { margin: "0 0 10px 0", fontSize: "22px", lineHeight: "1.4", fontWeight: 800, color: "#0b1f3a" };
const subhead = { margin: "0 0 14px 0", fontSize: "17px", lineHeight: "1.9", fontWeight: 500, color: "#3a4a64" };
const bodyText = { margin: 0, fontSize: "15px", lineHeight: "1.95", color: "#3a4a64" };
const rating = { margin: 0, fontSize: "14px", fontWeight: 700, color: "#0b1f3a" };
const stars = { color: "#f5b301", letterSpacing: "1px", margin: "0 8px" };
const ratingMeta = { fontWeight: 400, color: "#7b879b", fontSize: "13px" };
const metaCol = { padding: "0 4px" };
const audienceItem = { margin: "0 0 8px 0", fontSize: "15px", lineHeight: "1.85", color: "#3a4a64" };
const perksColLeft = { paddingLeft: "8px" };
const perksColRight = { paddingRight: "8px" };
const perkBottomWrap = { paddingTop: "14px" };
const card = { backgroundColor: "#f6f9ff", border: "1px solid #e3edfb", borderRadius: "10px", padding: "18px" };
const cardTitle = { margin: "0 0 6px 0", fontSize: "15px", fontWeight: 800, color: "#0b1f3a" };
const cardBody = { margin: 0, fontSize: "13.5px", lineHeight: "1.85", color: "#3a4a64" };
const browseRow = { marginTop: "14px", fontSize: "12.5px", color: "#7b879b" };
const browseLink = { color: "#1e7ff6", textDecoration: "none", fontWeight: 700 };

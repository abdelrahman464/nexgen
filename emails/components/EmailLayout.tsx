import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import * as React from "react";

type EmailLayoutProps = {
  preview: string;
  children: React.ReactNode;
  dir?: "ltr" | "rtl";
  brandName?: string;
  logoUrl?: string;
  topBarLabel?: string;
  showTopBarLabel?: boolean;
  footerTagline?: string;
  websiteUrl?: string;
  contactEmail?: string;
  privacyUrl?: string;
  termsUrl?: string;
  unsubscribeUrl?: string;
  disclaimer?: string;
};

export function EmailLayout({
  preview,
  children,
  dir = "ltr",
  brandName = "Nexgen Academy",
  logoUrl,
  footerTagline,
  websiteUrl,
  contactEmail,
  unsubscribeUrl,
  disclaimer,
}: EmailLayoutProps) {
  const isRtl = dir === "rtl";
  const finalFooterTagline =
    footerTagline ||
    "Nexgen Academy email communication. Please do not reply to this automated message.";
  const finalLogoUrl = logoUrl || "https://nexgen-academy.com/images/Logo.png";
  const iconicLogo = "https://nexgen-academy.com/logos/iconicLogo.png";
  const privacyUrl = "https://nexgen-academy.com/ar/privacy-policy";
  const termsUrl = "https://nexgen-academy.com/ar/terms-of-services";
  return (
    <Html lang={isRtl ? "ar" : "en"} dir={dir}>
      <Head>
        <style>{mobileStyles}</style>
      </Head>
      <Preview>{preview}</Preview>
      <Body className="mobile-body" style={body} dir={dir}>
        <Section className="desktop-y-padding" style={desktopYSpacer} />
        <Container className="mobile-container" style={outerContainer} dir={dir}>
          <Section style={headerSection}>
            <table
              role="presentation"
              width="100%"
              cellPadding={0}
              cellSpacing={0}
              border={0}
            >
              <tr>
                <td align="center">
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                  >
                    <tr>
                      <td style={logoIconWrap}>
                        <Img
                          src={finalLogoUrl}
                          alt={`${brandName} logo`}
                          width="207"
                          height="86"
                          style={logoIcon}
                        />
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </Section>
          <Section className="mobile-content" style={contentSection}>
            {children}
          </Section>
          <Hr style={divider} />
          <Section className="mobile-footer" style={footerSection}>
            <Img
              src={iconicLogo}
              alt={`${brandName} logo`}
              width="80"
              height="80"
              style={footerLogo}
            />
            <Text style={footerBrand}>{brandName}</Text>
            <Text style={footerTaglineStyle}>{finalFooterTagline}</Text>
            {(contactEmail || websiteUrl) && (
              <Text style={footerMeta}>
                {contactEmail ? (
                  <>
                    {isRtl ? "للتواصل: " : "Contact: "}
                    <Link href={`mailto:${contactEmail}`} style={footerLink}>
                      {contactEmail}
                    </Link>
                  </>
                ) : null}
                {contactEmail && websiteUrl ? " • " : null}
                {websiteUrl ? (
                  <Link href={websiteUrl} style={footerLink}>
                    {formatDisplayUrl(websiteUrl)}
                  </Link>
                ) : null}
              </Text>
            )}
            {(privacyUrl || termsUrl || unsubscribeUrl) && (
              <Text style={footerMeta}>
                {privacyUrl ? (
                  <Link href={privacyUrl} style={footerLink}>
                    {isRtl ? "سياسة الخصوصية" : "Privacy Policy"}
                  </Link>
                ) : null}
                {privacyUrl && termsUrl ? " • " : null}
                {termsUrl ? (
                  <Link href={termsUrl} style={footerLink}>
                    {isRtl ? "الشروط والأحكام" : "Terms"}
                  </Link>
                ) : null}
                {(privacyUrl || termsUrl) && unsubscribeUrl ? " • " : null}
                {unsubscribeUrl ? (
                  <Link href={unsubscribeUrl} style={footerLink}>
                    {isRtl ? "إلغاء الاشتراك" : "Unsubscribe"}
                  </Link>
                ) : null}
              </Text>
            )}
            <Text style={footerDisclaimer}>
              {disclaimer ||
                `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}
            </Text>
          </Section>
        </Container>
        <Section className="desktop-y-padding" style={desktopYSpacer} />
      </Body>
    </Html>
  );
}

function formatDisplayUrl(url: string) {
  try {
    const parsedUrl = new URL(url);

    return parsedUrl.host;
  } catch {
    return url.replace(/^https?:\/\//, "").split(/[?#]/)[0];
  }
}

const body = {
  backgroundColor: "#f1f4f9",
  margin: 0,
  padding: 0,
  fontFamily: "'Tajawal','Cairo',Tahoma,Arial,sans-serif",
};

const desktopYSpacer = {
  fontSize: "1px",
  height: "24px",
  lineHeight: "24px",
};

const outerContainer = {
  maxWidth: "600px",
  margin: "0 auto",
};

const headerSection = {
  backgroundColor: "#ffffff",
  borderRadius: "14px 14px 0 0",
  borderBottom: "1px solid #eef1f6",
};

const logoIconWrap = { padding: "0 10px 0 0" };
const logoIcon = { display: "block" };

const contentSection = {
  backgroundColor: "#ffffff",
  boxSizing: "border-box" as const,
  color: "#0b1f3a",
  fontSize: "15px",
  lineHeight: "1.9",
  padding: "28px 24px",
};

const divider = { borderColor: "#1c3158", margin: 0 };

const footerSection = {
  backgroundColor: "#0b1f3a",
  boxSizing: "border-box" as const,
  borderRadius: "0 0 14px 14px",
  textAlign: "center" as const,
  padding: "28px 24px",
};
const footerLogo = { display: "inline-block", margin: "0 auto 12px auto" };
const footerBrand = {
  color: "#ffffff",
  fontSize: "18px",
  fontWeight: 800,
  margin: "0 0 0px 0",
};
const footerTaglineStyle = {
  color: "#90a6c4",
  fontSize: "13px",
  lineHeight: "1.85",
  margin: "0 0 8px 0",
};
const footerMeta = {
  color: "#90a6c4",
  fontSize: "12.5px",
  lineHeight: "1.8",
  margin: "0 0 8px 0",
};
const footerLink = { color: "#7eb8ff", textDecoration: "none" };
const footerDisclaimer = {
  color: "#5e7494",
  fontSize: "11.5px",
  lineHeight: "1.8",
  margin: "8px 0 0 0",
};

const mobileStyles = `
  @media only screen and (max-width: 600px) {
    .desktop-y-padding {
      display: none !important;
      height: 0 !important;
      line-height: 0 !important;
      overflow: hidden !important;
    }
    .mobile-container {
      width: 100% !important;
      max-width: 100% !important;
    }
  }
  @media only screen and (max-width: 480px) {
    .mobile-body {
      padding: 0 !important;
    }
    .mobile-container {
      width: 100% !important;
      max-width: 100% !important;
    }
    .mobile-content {
      padding: 20px 14px !important;
    }
    .mobile-footer {
      padding: 22px 14px !important;
    }
    .mobile-hero {
      height: auto !important;
      max-width: 100% !important;
    }
    .mobile-h1 {
      font-size: 24px !important;
      line-height: 1.4 !important;
    }
    .mobile-button {
      max-width: 260px !important;
      width: 100% !important;
    }
    .mobile-meta-col {
      display: block !important;
      width: 100% !important;
      padding: 0 0 8px 0 !important;
    }
    .mobile-meta-card {
      padding: 12px 10px !important;
    }
    .mobile-promo-block {
      padding: 24px 14px !important;
    }
    .mobile-promo-code {
      font-size: 22px !important;
      letter-spacing: 2px !important;
      padding: 12px 14px !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
  }
`;

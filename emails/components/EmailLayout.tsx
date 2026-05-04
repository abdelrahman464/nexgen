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
  topBarLabel,
  showTopBarLabel = false,
  footerTagline,
  websiteUrl,
  contactEmail,
  privacyUrl,
  termsUrl,
  unsubscribeUrl,
  disclaimer,
}: EmailLayoutProps) {
  const isRtl = dir === "rtl";
  const finalFooterTagline =
    footerTagline ||
    "Nexgen Academy email communication. Please do not reply to this automated message.";
  const logoUrl = "https://nexgen-academy.com/images/Logo.png";
  const iconicLogo = "https://nexgen-academy.com/logos/iconicLogo.png";
  return (
    <Html lang={isRtl ? "ar" : "en"} dir={dir}>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={body} dir={dir}>
        <Container style={outerContainer} dir={dir}>
          <Section style={headerSection}>
            <table
              role="presentation"
              width="100%"
              cellPadding={0}
              cellSpacing={0}
              border={0}
            >
              <tr>
                <td align={"center"}>
                  <table
                    role="presentation"
                    cellPadding={0}
                    cellSpacing={0}
                    border={0}
                  >
                    <tr>
                      <td style={logoIconWrap}>
                        <Img
                          src={logoUrl}
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
          <Section style={contentSection}>{children}</Section>
          <Hr style={divider} />
          <Section style={footerSection}>
            <Img
              src={iconicLogo}
              alt={`${brandName} logo`}
              width="80"
              height="80"
              style={footerLogo}
            />
            <Text style={footerBrand}>{brandName}</Text>
            <Text style={footerTaglineStyle}>{finalFooterTagline}</Text>
            {/* {(contactEmail || websiteUrl) && (
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
                    {websiteUrl.replace(/^https?:\/\//, "")}
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
            )} */}
            {/* <Text style={footerDisclaimer}>
              {disclaimer ||
                `© ${new Date().getFullYear()} ${brandName}. All rights reserved.`}
            </Text> */}
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const body = {
  backgroundColor: "#f1f4f9",
  margin: 0,
  padding: "24px 12px",
  fontFamily: "'Tajawal','Cairo',Tahoma,Arial,sans-serif",
};

const outerContainer = {
  maxWidth: "600px",
  margin: "0 auto",
};

const headerSection = {
  backgroundColor: "#ffffff",
  borderRadius: "14px 14px 0 0",
  borderBottom: "1px solid #eef1f6",
  // padding: "22px 32px",
};

const logoIconWrap = { padding: "0 10px 0 0" };
const logoIcon = { display: "block" };
const logoText = {
  fontSize: "18px",
  fontWeight: 800,
  color: "#0b1f3a",
  letterSpacing: "0.2px",
};
const topBarMeta = {
  fontSize: "12px",
  fontWeight: 500,
  color: "#7b879b",
  letterSpacing: "0.4px",
};

const contentSection = {
  backgroundColor: "#ffffff",
  color: "#0b1f3a",
  fontSize: "15px",
  lineHeight: "1.9",
  padding: "28px 32px",
};

const divider = { borderColor: "#1c3158", margin: 0 };

const footerSection = {
  backgroundColor: "#0b1f3a",
  borderRadius: "0 0 14px 14px",
  textAlign: "center" as const,
  padding: "28px 32px",
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

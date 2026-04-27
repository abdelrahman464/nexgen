import { CodeInline, Section, Text } from "@react-email/components";
import * as React from "react";

type PromoCodeBlockProps = {
  label: string;
  title: string;
  description: string;
  code: string;
  footerText: string;
};

export function PromoCodeBlock({ label, title, description, code, footerText }: PromoCodeBlockProps) {
  return (
    <Section style={wrap}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={titleStyle}>{title}</Text>
      <Text style={descriptionStyle}>{description}</Text>
      <Text style={codeWrap}>
        <CodeInline style={codeStyle}>{code}</CodeInline>
      </Text>
      <Text style={footerStyle}>{footerText}</Text>
    </Section>
  );
}

const wrap = {
  backgroundColor: "#0b1f3a",
  borderRadius: "14px",
  textAlign: "center" as const,
  padding: "28px 22px",
};

const labelStyle = {
  margin: "0 0 10px 0",
  color: "#7eb8ff",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "1.5px",
};

const titleStyle = {
  margin: "0 0 8px 0",
  color: "#ffffff",
  fontSize: "24px",
  lineHeight: "1.4",
  fontWeight: 800,
};

const descriptionStyle = {
  margin: "0 0 18px 0",
  color: "#bcd2ee",
  fontSize: "14.5px",
  lineHeight: "1.9",
};

const codeWrap = { margin: "0 0 16px 0" };
const codeStyle = {
  backgroundColor: "#1e7ff6",
  border: "2px dashed #7eb8ff",
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontFamily: "'Courier New',Courier,monospace",
  fontSize: "26px",
  fontWeight: 800,
  letterSpacing: "6px",
  padding: "14px 28px",
};

const footerStyle = {
  margin: 0,
  color: "#7eb8ff",
  fontSize: "12.5px",
  lineHeight: "1.8",
};


import { Section } from "@react-email/components";
import * as React from "react";

type EmailSectionProps = {
  children: React.ReactNode;
  compact?: boolean;
  align?: "left" | "right" | "center";
};

export function EmailSection({ children, compact = false, align = "left" }: EmailSectionProps) {
  return <Section style={{ ...section, padding: compact ? "10px 0" : "18px 0", textAlign: align }}>{children}</Section>;
}

const section = {
  width: "100%",
};


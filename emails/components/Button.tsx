import { Button as BaseButton } from "@react-email/components";
import * as React from "react";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  width?: number;
};

export function Button({ href, children, width = 280 }: ButtonProps) {
  return (
    <BaseButton href={href} style={{ ...button, width: `${width}px` }}>
      {children}
    </BaseButton>
  );
}

const button = {
  backgroundColor: "#1e7ff6",
  borderRadius: "10px",
  color: "#ffffff",
  display: "inline-block",
  fontSize: "16px",
  fontWeight: 700,
  height: "54px",
  lineHeight: "54px",
  textAlign: "center" as const,
  textDecoration: "none",
  letterSpacing: "0.3px",
};

import { Link } from "@react-email/components";
import * as React from "react";

type ButtonProps = {
  href: string;
  children: React.ReactNode;
  width?: number;
};

export function Button({ href, children, width = 280 }: ButtonProps) {
  return (
    <Link href={href} dir="auto" style={{ ...button, width: `${width}px` }}>
      <span dir="auto" style={buttonText}>
        {children}
      </span>
    </Link>
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
  direction: "inherit" as const,
  unicodeBidi: "isolate" as const,
};

const buttonText = {
  display: "inline-block",
  lineHeight: "54px",
  direction: "inherit" as const,
  unicodeBidi: "isolate" as const,
};

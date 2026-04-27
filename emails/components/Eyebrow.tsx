import { Text } from "@react-email/components";
import * as React from "react";

type EyebrowProps = {
  children: React.ReactNode;
};

export function Eyebrow({ children }: EyebrowProps) {
  return (
    <Text style={eyebrowWrap}>
      <span style={eyebrowChip}>{children}</span>
    </Text>
  );
}

const eyebrowWrap = {
  margin: "0 0 12px 0",
};

const eyebrowChip = {
  display: "inline-block",
  backgroundColor: "#eaf3ff",
  color: "#1e7ff6",
  borderRadius: "999px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: 700,
  letterSpacing: "1px",
};


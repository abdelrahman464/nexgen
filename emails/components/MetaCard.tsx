import { Text } from "@react-email/components";
import * as React from "react";

type MetaCardProps = {
  label: string;
  value: string;
};

export function MetaCard({ label, value }: MetaCardProps) {
  return (
    <div className="mobile-meta-card" style={card}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </div>
  );
}

const card = {
  backgroundColor: "#f6f9ff",
  border: "1px solid #e3edfb",
  borderRadius: "10px",
  boxSizing: "border-box" as const,
  textAlign: "center" as const,
  padding: "14px 8px",
  width: "100%",
};

const labelStyle = {
  margin: "0 0 4px 0",
  fontSize: "11px",
  fontWeight: 600,
  color: "#7b879b",
};

const valueStyle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: 800,
  color: "#0b1f3a",
};


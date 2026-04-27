import { Row, Column, Text } from "@react-email/components";
import * as React from "react";

export type FeatureListItem = {
  index: string;
  title: string;
  description: string;
};

type FeatureListProps = {
  items: FeatureListItem[];
};

export function FeatureList({ items }: FeatureListProps) {
  return (
    <>
      {items.map((item) => (
        <Row key={`${item.index}-${item.title}`} style={row}>
          <Column width="28" style={indexCell}>
            <Text style={indexText}>{item.index}</Text>
          </Column>
          <Column>
            <Text style={itemText}>
              <strong>{item.title}:</strong> <span style={itemDescription}>{item.description}</span>
            </Text>
          </Column>
        </Row>
      ))}
    </>
  );
}

const row = { marginBottom: "12px" };
const indexCell = { width: "28px" };
const indexText = { margin: 0, fontSize: "14px", fontWeight: 800, color: "#1e7ff6", lineHeight: "1.7" };
const itemText = { margin: 0, fontSize: "15px", lineHeight: "1.85", color: "#0b1f3a" };
const itemDescription = { color: "#3a4a64" };


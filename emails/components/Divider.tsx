import { Hr } from "@react-email/components";
import * as React from "react";

export function Divider() {
  return <Hr style={divider} />;
}

const divider = {
  borderColor: "#eef1f6",
  margin: "18px 0",
};

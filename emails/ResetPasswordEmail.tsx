import { CodeInline, Heading, Text } from "@react-email/components";
import * as React from "react";
import { Divider } from "./components/Divider";
import { EmailLayout } from "./components/EmailLayout";

export type ResetPasswordEmailProps = {
  name: string;
  resetCode: string;
  expiresInMinutes: number;
};

export const PreviewProps: ResetPasswordEmailProps = {
  name: "Nexgen Learner",
  resetCode: "924318",
  expiresInMinutes: 10,
};

export function ResetPasswordEmail({
  name,
  resetCode,
  expiresInMinutes,
}: ResetPasswordEmailProps) {
  return (
    <EmailLayout preview="Password reset verification code">
      <Heading as="h2">Password Reset Verification Code</Heading>
      <Text>Hello {name},</Text>
      <Text>Use this code to complete your password reset:</Text>
      <Text>
        <CodeInline>{resetCode}</CodeInline>
      </Text>
      <Divider />
      <Text>This code expires in {expiresInMinutes} minutes.</Text>
      <Text>If you did not request this, you can safely ignore this email.</Text>
    </EmailLayout>
  );
}

(ResetPasswordEmail as typeof ResetPasswordEmail & { PreviewProps: ResetPasswordEmailProps }).PreviewProps =
  PreviewProps;

export default ResetPasswordEmail;

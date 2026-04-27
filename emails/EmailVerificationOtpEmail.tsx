import { CodeInline, Heading, Text } from "@react-email/components";
import * as React from "react";
import { Divider } from "./components/Divider";
import { EmailLayout } from "./components/EmailLayout";

export type EmailVerificationOtpEmailProps = {
  name: string;
  otpCode: string;
  expiresInMinutes: number;
};

export const PreviewProps: EmailVerificationOtpEmailProps = {
  name: "Nexgen Learner",
  otpCode: "583741",
  expiresInMinutes: 10,
};

export function EmailVerificationOtpEmail({
  name,
  otpCode,
  expiresInMinutes,
}: EmailVerificationOtpEmailProps) {
  return (
    <EmailLayout preview="Your email verification code">
      <Heading as="h2">Email Verification Code</Heading>
      <Text>Hello {name},</Text>
      <Text>Use the following code to verify your email address:</Text>
      <Text>
        <CodeInline>{otpCode}</CodeInline>
      </Text>
      <Divider />
      <Text>This code expires in {expiresInMinutes} minutes.</Text>
      <Text>If you did not request this, please ignore this email.</Text>
    </EmailLayout>
  );
}

export default EmailVerificationOtpEmail;

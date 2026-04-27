import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { Button } from "./components/Button";
import { Divider } from "./components/Divider";
import { EmailLayout } from "./components/EmailLayout";

export type WelcomeEmailProps = {
  name: string;
  loginUrl: string;
};

export const PreviewProps: WelcomeEmailProps = {
  name: "Nexgen Learner",
  loginUrl: "https://example.com/login",
};

export function WelcomeEmail({ name, loginUrl }: WelcomeEmailProps) {
  return (
    <EmailLayout preview={`Welcome to Nexgen, ${name}`}>
      <Heading as="h2">Welcome to Nexgen Academy</Heading>
      <Text>Hello {name},</Text>
      <Text>We are excited to have you with us. Your account is ready.</Text>
      <Button href={loginUrl}>Log in to your account</Button>
      <Divider />
      <Text>You can also use this direct link: {loginUrl}</Text>
      <Text>See you inside.</Text>
    </EmailLayout>
  );
}

export default WelcomeEmail;

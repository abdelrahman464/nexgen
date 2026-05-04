import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { Button } from "./components/Button";
import { Divider } from "./components/Divider";
import { EmailLayout } from "./components/EmailLayout";

export type CourseEnrolledEmailProps = {
  name: string;
  courseTitle: string;
  instructorName: string;
  courseUrl: string;
};

export const PreviewProps: CourseEnrolledEmailProps = {
  name: "Nexgen Learner",
  courseTitle: "Node.js Bootcamp",
  instructorName: "Jane Instructor",
  courseUrl: "https://example.com/courses/nodejs-bootcamp",
};

export function CourseEnrolledEmail({
  name,
  courseTitle,
  instructorName,
  courseUrl,
}: CourseEnrolledEmailProps) {
  return (
    <EmailLayout preview={`You're enrolled in ${courseTitle}`}>
      <Heading as="h2">You are enrolled</Heading>
      <Text>Hello {name},</Text>
      <Text>
        You are now enrolled in <strong>{courseTitle}</strong>.
      </Text>
      <Text>Instructor: {instructorName}</Text>
      <Button href={courseUrl}>Start Learning</Button>
      <Divider />
      <Text>Best of luck with your learning journey.</Text>
    </EmailLayout>
  );
}

(CourseEnrolledEmail as typeof CourseEnrolledEmail & { PreviewProps: CourseEnrolledEmailProps }).PreviewProps =
  PreviewProps;

export default CourseEnrolledEmail;

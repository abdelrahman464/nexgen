import { Heading, Text } from "@react-email/components";
import * as React from "react";
import { Button } from "./components/Button";
import { Divider } from "./components/Divider";
import { EmailLayout } from "./components/EmailLayout";

export type NewCourseAddedEmailProps = {
  name: string;
  courseTitle: string;
  instructorName: string;
  courseUrl: string;
};

export const PreviewProps: NewCourseAddedEmailProps = {
  name: "Nexgen Learner",
  courseTitle: "Advanced Express Architecture",
  instructorName: "John Mentor",
  courseUrl: "https://example.com/courses/advanced-express-architecture",
};

export function NewCourseAddedEmail({
  name,
  courseTitle,
  instructorName,
  courseUrl,
}: NewCourseAddedEmailProps) {
  return (
    <EmailLayout preview={`New course available: ${courseTitle}`}>
      <Heading as="h2">A New Course Was Added</Heading>
      <Text>Hello {name},</Text>
      <Text>
        Great news! A new course is now available: <strong>{courseTitle}</strong>.
      </Text>
      <Text>Instructor: {instructorName}</Text>
      <Button href={courseUrl}>View Course</Button>
      <Divider />
      <Text>Open the course page to check full details and start learning.</Text>
    </EmailLayout>
  );
}

(NewCourseAddedEmail as typeof NewCourseAddedEmail & { PreviewProps: NewCourseAddedEmailProps }).PreviewProps =
  PreviewProps;

export default NewCourseAddedEmail;

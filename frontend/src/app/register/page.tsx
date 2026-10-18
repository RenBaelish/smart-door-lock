import type { Metadata } from "next";
import RegisterView from "@/components/views/RegisterView";

export const metadata: Metadata = {
  title: "Register User",
  description: "Enroll a new user by capturing a face photo from the webcam.",
};

export default function RegisterPage() {
  return <RegisterView />;
}

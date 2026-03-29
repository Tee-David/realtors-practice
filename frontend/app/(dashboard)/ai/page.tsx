import { redirect } from "next/navigation";

// Legacy /ai route — redirect to the full assistant page
export default function AIPage() {
  redirect("/assistant");
}

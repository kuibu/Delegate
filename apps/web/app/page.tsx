import { redirect } from "next/navigation";

export default function DashboardRootPage() {
  redirect("/dashboard?view=overview");
}

import { redirect } from "next/navigation";

export default function RepresentativesRootPage() {
  redirect(`/reps/${process.env.DEMO_REP_SLUG?.trim() || "lin-founder-rep"}`);
}

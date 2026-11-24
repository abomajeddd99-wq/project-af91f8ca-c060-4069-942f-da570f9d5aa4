import { createFileRoute } from "@tanstack/react-router";
import { CareerProfile } from "@/components/app/CareerProfile";
import { careerPathsQuery } from "@/lib/catalog";
import { profileQuery } from "@/lib/queries";
export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [ { title: "استكمال الحساب الشخصي — إنجازي" }, { name: "description", content: "اختيار المسار الوظيفي وبيانات حسابك الشخصي المستقل." }, { property: "og:title", content: "استكمال الحساب الشخصي — إنجازي" }, { property: "og:description", content: "اختيار المسار الوظيفي وبياناتك المهنية." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" } ] }),
  loader: ({ context }) => Promise.all([context.queryClient.ensureQueryData(careerPathsQuery()), context.queryClient.ensureQueryData(profileQuery(context.user.id))]),
  component: () => { const { user } = Route.useRouteContext(); return <CareerProfile userId={user.id} />; },
});
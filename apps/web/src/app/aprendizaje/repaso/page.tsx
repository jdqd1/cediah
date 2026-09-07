import { ReviewLauncher } from "@/components/learning/review-launcher";

export const dynamic = "force-dynamic";

export default async function LearningReviewPage({ searchParams }: {
  searchParams: Promise<{ minutos?: string }>;
}) {
  const requested = Number((await searchParams).minutos);
  const minutes = requested === 5 || requested === 20 ? requested : 10;
  return <ReviewLauncher minutes={minutes} />;
}

import { CardGridSkeleton } from "@/components/photo-card";
import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-16">
      <div className="mb-10 h-12 w-2/3 max-w-lg animate-pulse rounded-lg bg-surface" aria-hidden="true" />
      <CardGridSkeleton label="Loading homes" />
    </Container>
  );
}

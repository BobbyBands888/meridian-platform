import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-10">
      <div role="status" aria-label="Loading home" className="space-y-6">
        <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-surface sm:aspect-[16/9]" />
        <div className="h-12 w-1/3 animate-pulse rounded-lg bg-surface" />
        <div className="h-6 w-1/2 animate-pulse rounded-lg bg-surface" />
      </div>
    </Container>
  );
}

import { Container } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-14" >
      <div role="status" aria-label="Loading vendor" className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <div className="aspect-[4/3] w-full animate-pulse rounded-2xl bg-surface sm:aspect-square sm:w-48" />
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-surface" />
          <div className="h-24 w-full animate-pulse rounded-lg bg-surface" />
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-surface" />
      </div>
    </Container>
  );
}

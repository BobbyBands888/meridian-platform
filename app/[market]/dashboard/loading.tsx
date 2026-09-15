import { Container, Spinner } from "@/components/ui";

export default function Loading() {
  return (
    <Container className="py-24">
      <div role="status" className="flex items-center justify-center gap-3 text-muted">
        <Spinner />
        <span>Loading your account…</span>
      </div>
    </Container>
  );
}

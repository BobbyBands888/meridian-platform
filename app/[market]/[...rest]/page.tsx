import { notFound } from "next/navigation";

// Unmatched paths on a market site render that site's 404 (with its header and footer) instead of the bare global one.
export default function CatchAll() {
  notFound();
}

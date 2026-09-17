import assert from "node:assert/strict";
import { test } from "node:test";
import { fairVendorOrder, rotationDay } from "./vendor-order.ts";

const vendors = Array.from({ length: 8 }, (_, i) => ({ id: `vendor-${i}`, verified_at: i % 3 === 0 ? "2026-09-01T00:00:00Z" : null }));

test("verified vendors always come before unverified ones", () => {
  for (const day of ["2026-09-17", "2026-09-18", "2026-12-01"]) {
    const ordered = fairVendorOrder(vendors, "lender", day);
    const firstUnverified = ordered.findIndex((v) => !v.verified_at);
    assert.ok(ordered.slice(firstUnverified).every((v) => !v.verified_at));
    assert.equal(ordered.length, vendors.length);
    assert.deepEqual(new Set(ordered.map((v) => v.id)), new Set(vendors.map((v) => v.id)));
  }
});

test("order is stable within a day and ignores input order", () => {
  const a = fairVendorOrder(vendors, "lender", "2026-09-17").map((v) => v.id);
  const b = fairVendorOrder([...vendors].reverse(), "lender", "2026-09-17").map((v) => v.id);
  assert.deepEqual(a, b);
});

test("order rotates across days", () => {
  const days = Array.from({ length: 14 }, (_, i) => `2026-10-${String(i + 1).padStart(2, "0")}`);
  const firsts = new Set(days.map((day) => fairVendorOrder(vendors, "lender", day).find((v) => !v.verified_at)!.id));
  assert.ok(firsts.size > 1, "the first unverified vendor should change over two weeks");
});

test("rotation day uses Central time", () => {
  assert.equal(rotationDay(new Date("2026-09-18T03:00:00Z")), "2026-09-17");
  assert.equal(rotationDay(new Date("2026-09-18T06:00:00Z")), "2026-09-18");
});

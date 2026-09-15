"use client";

import Form from "next/form";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui";
import type { ZipGroup } from "@/lib/areas";

type Values = { q: string; zip: string; min_price: string; max_price: string; beds: string; baths: string };

const priceSteps = [100_000, 200_000, 300_000, 400_000, 500_000, 600_000, 750_000, 1_000_000, 1_500_000, 2_000_000];
const priceLabel = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : `${n / 1000}K`);

export function HomeFilters({ values, zipGroups }: { values: Values; zipGroups: ZipGroup[] }) {
  return (
    <Form action="/homes" aria-label="Filter homes" className="rounded-2xl border border-line p-4 sm:p-5">
      {values.q && <input type="hidden" name="q" value={values.q} />}
      {values.q && (
        <p className="mb-4 flex flex-wrap items-center gap-2 text-[15px]">
          Showing results near <span className="font-semibold">&ldquo;{values.q}&rdquo;</span>
          <Link href="/homes" className="text-forest underline underline-offset-2">
            Clear search
          </Link>
        </p>
      )}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto] lg:items-end">
        <Select name="min_price" label="Min price" defaultValue={values.min_price} options={priceSteps.map((p) => [String(p), priceLabel(p)])} anyLabel="No min" />
        <Select name="max_price" label="Max price" defaultValue={values.max_price} options={priceSteps.map((p) => [String(p), priceLabel(p)])} anyLabel="No max" />
        <Select name="beds" label="Beds" defaultValue={values.beds} options={[1, 2, 3, 4, 5].map((n) => [String(n), `${n}+`])} anyLabel="Any" />
        <Select name="baths" label="Baths" defaultValue={values.baths} options={[1, 2, 3, 4].map((n) => [String(n), `${n}+`])} anyLabel="Any" />
        <div className="col-span-2 lg:col-span-1">
          <label htmlFor="filter-zip" className="block text-[13px] font-medium text-muted">
            ZIP
          </label>
          <select id="filter-zip" name="zip" defaultValue={values.zip} className="mt-1 min-h-12 w-full rounded-lg border border-ink/20 bg-white px-3 text-base focus:border-forest focus:outline-none">
            <option value="">All ZIPs</option>
            {zipGroups.map((group) => (
              <optgroup key={group.county} label={`${group.county} County`}>
                {group.options.map((o) => (
                  <option key={o.zip} value={o.zip}>
                    {o.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <ApplyButton />
        </div>
      </div>
    </Form>
  );
}

function Select({ name, label, defaultValue, options, anyLabel }: { name: string; label: string; defaultValue: string; options: string[][]; anyLabel: string }) {
  const id = `filter-${name}`;
  return (
    <div>
      <label htmlFor={id} className="block text-[13px] font-medium text-muted">
        {label}
      </label>
      <select id={id} name={name} defaultValue={defaultValue} className="mt-1 min-h-12 w-full rounded-lg border border-ink/20 bg-white px-3 text-base focus:border-forest focus:outline-none">
        <option value="">{anyLabel}</option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}

function ApplyButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="forest" pending={pending} pendingLabel="Updating" className="sm:w-full lg:w-auto">
      Apply filters
    </Button>
  );
}

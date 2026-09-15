"use client";

import { useId, useState } from "react";
import { formatPrice } from "@/lib/listings";

const MIN = 150_000;
const MAX = 1_500_000;
const STEP = 10_000;
const DEFAULT = 450_000;

/**
 * Shows what a traditional sale's commission comes to at 5% and 6% of a price the visitor picks. It's arithmetic
 * on their number and nothing more: no estimate of what they'd net, and no claim about what any agent charges.
 */
export function CommissionCalculator({ brand }: { brand: string }) {
  const id = useId();
  const [price, setPrice] = useState(DEFAULT);

  return (
    <div className="rounded-3xl border border-line p-6 sm:p-10">
      <label htmlFor={id} className="block text-[15px] font-medium">
        Sale price
      </label>
      <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{formatPrice(price)}</p>
      <input
        id={id}
        type="range"
        min={MIN}
        max={MAX}
        step={STEP}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        aria-valuetext={formatPrice(price)}
        className="mt-5 h-2 w-full cursor-pointer appearance-none rounded-full bg-line accent-forest focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-forest"
      />
      <div className="mt-1 flex justify-between text-[13px] text-muted">
        <span>{formatPrice(MIN)}</span>
        <span>{formatPrice(MAX)}</span>
      </div>

      <dl aria-live="polite" className="mt-8 grid gap-3 sm:grid-cols-2">
        {[5, 6].map((rate) => (
          <div key={rate} className="rounded-2xl bg-surface p-5">
            <dt className="text-[15px] text-muted">Agent commission at {rate}%</dt>
            <dd className="mt-1 text-3xl font-bold tracking-tight tabular-nums">{formatPrice(Math.round((price * rate) / 100))}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-[17px] leading-relaxed">
        That&apos;s what a traditional sale pays in commission. {brand} is free.
      </p>
    </div>
  );
}

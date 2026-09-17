"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { trackBuyerToolOnce } from "@/components/buyer-tracking";
import { calculatorCardClass, rangeInputClass, resultTileClass } from "@/components/ui";
import { estimateBuyerCosts, type LoanType, type VaUse } from "@/lib/buyer-costs/calc";
import { combinedRate, COUNTY_TAX, EXAMPLE_DEFAULTS, LOAN_RULES, type CountyTax, type TaxArea } from "@/lib/buyer-costs/rates";

const PRICE_MIN = 100_000;
const PRICE_MAX = 2_000_000;

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const fmt = (n: number) => money.format(Math.round(n));

type State = {
  price: number;
  downMode: "pct" | "usd";
  down: number;
  rate: number;
  term: 15 | 30;
  loan: LoanType;
  va: VaUse;
  county: string;
  inCity: boolean;
  area: string;
  /** A tax rate the buyer typed in, replacing the looked-up one; null uses the lookup. */
  taxOverride: number | null;
  insurance: number;
  hoa: number;
};

const num = (value: string | null, fallback: number, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const n = value === null || value === "" ? NaN : Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

function initialState(params: URLSearchParams): State {
  const county = COUNTY_TAX.some((c) => c.county === params.get("county")) ? params.get("county")! : (COUNTY_TAX[0]?.county ?? "");
  const countyInfo = COUNTY_TAX.find((c) => c.county === county);
  const inCity = params.get("city") === "1" && Boolean(countyInfo?.cities.length);
  const areas = (inCity ? countyInfo?.cities : countyInfo?.outside) ?? [];
  const area = areas.some((a) => a.id === params.get("area")) ? params.get("area")! : (areas[0]?.id ?? "");
  const downMode = params.get("dm") === "usd" ? "usd" : "pct";
  const loan = (["conventional", "fha", "va"] as const).find((l) => l === params.get("loan")) ?? "conventional";
  return {
    price: num(params.get("price"), EXAMPLE_DEFAULTS.price, 0, 20_000_000),
    downMode,
    down: num(params.get("down"), downMode === "pct" ? EXAMPLE_DEFAULTS.downPercent : (EXAMPLE_DEFAULTS.price * EXAMPLE_DEFAULTS.downPercent) / 100, 0, downMode === "pct" ? 100 : 20_000_000),
    rate: num(params.get("rate"), EXAMPLE_DEFAULTS.ratePercent, 0, 25),
    term: params.get("term") === "15" ? 15 : 30,
    loan,
    va: (["first", "subsequent", "exempt"] as const).find((v) => v === params.get("va")) ?? "first",
    county,
    inCity,
    area,
    taxOverride: params.has("tax") ? num(params.get("tax"), 0, 0, 20) : null,
    insurance: num(params.get("ins"), EXAMPLE_DEFAULTS.insuranceYearly, 0, 100_000),
    hoa: num(params.get("hoa"), 0, 0, 10_000),
  };
}

/** Inputs as URL params: numbers and choices only, never anything personal. */
function toParams(s: State) {
  const p = new URLSearchParams();
  p.set("price", String(s.price));
  p.set("dm", s.downMode);
  p.set("down", String(s.down));
  p.set("rate", String(s.rate));
  p.set("term", String(s.term));
  p.set("loan", s.loan);
  if (s.loan === "va") p.set("va", s.va);
  p.set("county", s.county);
  if (s.inCity) p.set("city", "1");
  p.set("area", s.area);
  if (s.taxOverride !== null) p.set("tax", String(s.taxOverride));
  p.set("ins", String(s.insurance));
  if (s.hoa) p.set("hoa", String(s.hoa));
  return p;
}

const SEGMENTS = [
  { key: "principalAndInterest", label: "Principal & interest", color: "bg-forest" },
  { key: "propertyTax", label: "Property tax", color: "bg-warm" },
  { key: "insurance", label: "Homeowners insurance", color: "bg-[#6b8f7e]" },
  { key: "mortgageInsurance", label: "Mortgage insurance", color: "bg-[#8a5a2b]" },
  { key: "hoa", label: "HOA", color: "bg-[#9aa19d]" },
] as const;

/**
 * Estimated monthly payment and cash to close for a home in one of the market's counties. Runs entirely in the browser;
 * the inputs are mirrored into the URL so an estimate can be shared.
 */
export function BuyerCostCalculator() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [s, setS] = useState<State>(() => initialState(new URLSearchParams(searchParams.toString())));
  const id = useId();
  const touched = useRef(false);

  const update = (patch: Partial<State>) => {
    touched.current = true;
    trackBuyerToolOnce("calculator_use");
    setS((prev) => ({ ...prev, ...patch }));
  };

  // Mirror inputs into the URL after typing settles, without adding history entries or scrolling.
  useEffect(() => {
    if (!touched.current) return;
    const timer = setTimeout(() => {
      const query = toParams(s).toString();
      const keep = new URLSearchParams(window.location.search).get("s");
      router.replace(`${pathname}?${keep ? `s=${keep}&` : ""}${query}`, { scroll: false });
    }, 400);
    return () => clearTimeout(timer);
  }, [s, router, pathname]);

  const county: CountyTax | undefined = COUNTY_TAX.find((c) => c.county === s.county);
  const areaChoices: TaxArea[] = (s.inCity ? county?.cities : county?.outside) ?? [];
  const area = areaChoices.find((a) => a.id === s.area) ?? areaChoices[0];
  const lookedUpRate = area ? combinedRate(area) : 0;
  const taxRate = s.taxOverride ?? lookedUpRate;
  const downPayment = s.downMode === "pct" ? (s.price * s.down) / 100 : s.down;

  const estimate = estimateBuyerCosts(
    { price: s.price, downPayment, ratePercent: s.rate, termYears: s.term, loanType: s.loan, vaUse: s.va, taxRatePer100: taxRate, insuranceYearly: s.insurance, hoaMonthly: s.hoa },
    LOAN_RULES,
  );

  const setCounty = (name: string) => {
    const next = COUNTY_TAX.find((c) => c.county === name);
    update({ county: name, inCity: false, area: next?.outside[0]?.id ?? "", taxOverride: null });
  };
  const setInCity = (inCity: boolean) => {
    const list = (inCity ? county?.cities : county?.outside) ?? [];
    update({ inCity, area: list[0]?.id ?? "", taxOverride: null });
  };

  const m = estimate.monthly;
  const total = m.total || 1;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <form className={`${calculatorCardClass} space-y-7`} onSubmit={(e) => e.preventDefault()} aria-label="Your numbers">
        <div>
          <label htmlFor={`${id}-price`} className="block text-[15px] font-medium">
            Home price
          </label>
          <MoneyInput id={`${id}-price`} value={s.price} onChange={(price) => update({ price })} />
          <input
            type="range"
            min={PRICE_MIN}
            max={PRICE_MAX}
            step={5_000}
            value={Math.min(PRICE_MAX, Math.max(PRICE_MIN, s.price))}
            onChange={(e) => update({ price: Number(e.target.value) })}
            aria-label="Home price slider"
            aria-valuetext={fmt(s.price)}
            className={`mt-4 ${rangeInputClass}`}
          />
          <p className="mt-2 text-[13px] text-muted">The price stands in for the appraised value when figuring property tax.</p>
        </div>

        <fieldset>
          <legend className="text-[15px] font-medium">Down payment</legend>
          <div className="mt-2 flex gap-3">
            <div className="min-w-0 flex-1">
              <label htmlFor={`${id}-down`} className="sr-only">
                Down payment {s.downMode === "pct" ? "percent" : "dollars"}
              </label>
              {s.downMode === "pct" ? (
                <SuffixInput id={`${id}-down`} value={s.down} suffix="%" step={0.5} max={100} onChange={(down) => update({ down })} />
              ) : (
                <MoneyInput id={`${id}-down`} value={s.down} onChange={(down) => update({ down })} />
              )}
            </div>
            <Segmented
              label="Enter down payment as"
              value={s.downMode}
              options={[
                { value: "pct", label: "%" },
                { value: "usd", label: "$" },
              ]}
              onChange={(mode) =>
                update({ downMode: mode, down: mode === "pct" ? (s.price > 0 ? Math.round((downPayment / s.price) * 1000) / 10 : 0) : Math.round(downPayment) })
              }
            />
          </div>
          <p className="mt-2 text-[13px] text-muted">
            {fmt(downPayment)} down · {s.price > 0 ? `${Math.round((downPayment / s.price) * 1000) / 10}%` : "0%"} of the price
          </p>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-rate`} className="block text-[15px] font-medium">
              Interest rate
            </label>
            <SuffixInput id={`${id}-rate`} value={s.rate} suffix="%" step={0.125} max={25} onChange={(rate) => update({ rate })} describedBy={`${id}-rate-note`} />
            <p id={`${id}-rate-note`} className="mt-2 text-[13px] text-muted">
              Example rate. Enter the rate from your lender&apos;s Loan Estimate.
            </p>
          </div>
          <fieldset>
            <legend className="text-[15px] font-medium">Loan term</legend>
            <div className="mt-2">
              <Segmented
                label="Loan term"
                value={String(s.term)}
                options={[
                  { value: "30", label: "30 years" },
                  { value: "15", label: "15 years" },
                ]}
                onChange={(v) => update({ term: v === "15" ? 15 : 30 })}
              />
            </div>
          </fieldset>
        </div>

        <fieldset>
          <legend className="text-[15px] font-medium">Loan type</legend>
          <div className="mt-2">
            <Segmented
              label="Loan type"
              value={s.loan}
              options={[
                { value: "conventional", label: "Conventional" },
                { value: "fha", label: "FHA" },
                { value: "va", label: "VA" },
              ]}
              onChange={(loan) => update({ loan })}
            />
          </div>
          {s.loan === "va" && (
            <div className="mt-4">
              <label htmlFor={`${id}-va`} className="block text-[15px] font-medium">
                VA funding fee
              </label>
              <select id={`${id}-va`} value={s.va} onChange={(e) => update({ va: e.target.value as VaUse })} className={selectClass}>
                <option value="first">First time using a VA loan</option>
                <option value="subsequent">Used a VA loan before</option>
                <option value="exempt">Exempt (for example, receiving VA disability compensation)</option>
              </select>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-4">
          <legend className="text-[15px] font-medium">Location, for property tax</legend>
          <div>
            <label htmlFor={`${id}-county`} className="block text-[14px] text-muted">
              County
            </label>
            <select id={`${id}-county`} value={s.county} onChange={(e) => setCounty(e.target.value)} className={selectClass}>
              {COUNTY_TAX.map((c) => (
                <option key={c.county} value={c.county}>
                  {c.county} County
                </option>
              ))}
            </select>
          </div>
          {county && county.cities.length > 0 && (
            <div>
              <p id={`${id}-incity`} className="text-[14px] text-muted">
                Inside city limits?
              </p>
              <div className="mt-2">
                <Segmented
                  label="Inside city limits?"
                  labelledBy={`${id}-incity`}
                  value={s.inCity ? "yes" : "no"}
                  options={[
                    { value: "no", label: "No" },
                    { value: "yes", label: "Yes" },
                  ]}
                  onChange={(v) => setInCity(v === "yes")}
                />
              </div>
            </div>
          )}
          {areaChoices.length > 1 && (
            <div>
              <label htmlFor={`${id}-area`} className="block text-[14px] text-muted">
                {s.inCity ? "City" : "Area"}
              </label>
              <select id={`${id}-area`} value={area?.id ?? ""} onChange={(e) => update({ area: e.target.value, taxOverride: null })} className={selectClass}>
                {areaChoices.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          {county?.note && <p className="text-[13px] leading-relaxed text-muted">{county.note}</p>}
          <div>
            <label htmlFor={`${id}-tax`} className="block text-[14px] text-muted">
              Tax rate per $100 of assessed value
            </label>
            <SuffixInput
              id={`${id}-tax`}
              value={taxRate}
              suffix="per $100"
              step={0.0001}
              max={20}
              onChange={(v) => update({ taxOverride: v })}
              describedBy={`${id}-tax-note`}
            />
            <div id={`${id}-tax-note`} className="mt-2 space-y-1 text-[13px] leading-relaxed text-muted">
              {s.taxOverride !== null ? (
                <p>
                  Using the rate you entered.{" "}
                  <button type="button" onClick={() => update({ taxOverride: null })} className="font-medium text-forest underline underline-offset-2">
                    Use the looked-up rate ({lookedUpRate})
                  </button>
                </p>
              ) : area ? (
                <>
                  <p>
                    {area.parts.map((p) => `${p.label} ${p.rate}`).join(" + ")} · {area.taxYear} rate
                  </p>
                  {area.status === "estimate" && (
                    <p className="font-medium text-ink">Estimate, confirm on your trustee&apos;s bill.</p>
                  )}
                  <p>
                    {area.sources.length === 1 ? "Source" : "Sources"}:{" "}
                    {area.sources.map((src, i) => (
                      <span key={src.url}>
                        {i > 0 && "; "}
                        <a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                          {src.label}
                        </a>
                      </span>
                    ))}
                  </p>
                </>
              ) : null}
            </div>
          </div>
        </fieldset>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-ins`} className="block text-[15px] font-medium">
              Homeowners insurance <span className="font-normal text-muted">(per year, optional)</span>
            </label>
            <MoneyInput id={`${id}-ins`} value={s.insurance} onChange={(insurance) => update({ insurance })} describedBy={`${id}-ins-note`} />
            <p id={`${id}-ins-note`} className="mt-2 text-[13px] text-muted">
              Example: the Tennessee average. Use your own quote.
            </p>
          </div>
          <div>
            <label htmlFor={`${id}-hoa`} className="block text-[15px] font-medium">
              HOA dues <span className="font-normal text-muted">(per month, optional)</span>
            </label>
            <MoneyInput id={`${id}-hoa`} value={s.hoa} onChange={(hoa) => update({ hoa })} />
          </div>
        </div>
      </form>

      <div aria-live="polite" className="space-y-6 lg:sticky lg:top-24 lg:self-start">
        <div className={calculatorCardClass}>
          <p className="text-[15px] font-medium">Estimated monthly payment</p>
          <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{fmt(m.total)}</p>
          <div className="mt-5 flex h-3 overflow-hidden rounded-full bg-line" aria-hidden="true">
            {SEGMENTS.map((seg) => (m[seg.key] > 0 ? <div key={seg.key} className={seg.color} style={{ width: `${(m[seg.key] / total) * 100}%` }} /> : null))}
          </div>
          <dl className="mt-5 space-y-2 text-[15px]">
            {SEGMENTS.map((seg) => (
              <div key={seg.key} className="flex items-center justify-between gap-4">
                <dt className="flex items-center gap-2">
                  <span className={`inline-block h-3 w-3 rounded-sm ${seg.color}`} aria-hidden="true" />
                  {seg.key === "mortgageInsurance" && estimate.mortgageInsuranceLabel ? estimate.mortgageInsuranceLabel : seg.label}
                </dt>
                <dd className="tabular-nums">{fmt(m[seg.key])}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            {s.loan === "va"
              ? "VA loans have no monthly mortgage insurance."
              : s.loan === "fha"
                ? "FHA annual premium figured on the starting loan amount, so it runs slightly high."
                : estimate.monthly.mortgageInsurance > 0
                  ? "PMI assumes 0.60% of the loan a year. Yours depends on credit score and down payment, and can be removed as you pay down the loan."
                  : "No PMI with 20% or more down."}
            {estimate.financedFee > 0 && ` Includes the ${estimate.financedFeeLabel} of ${fmt(estimate.financedFee)}, added to the loan (${fmt(estimate.totalLoan)} total).`}
          </p>
        </div>

        <div className={calculatorCardClass}>
          <p className="text-[15px] font-medium">Estimated cash to close</p>
          <p className="mt-1 text-3xl font-bold tracking-tight tabular-nums">
            {fmt(estimate.cashToClose.totalLow)} – {fmt(estimate.cashToClose.totalHigh)}
          </p>
          <dl className="mt-5 space-y-2 text-[15px]">
            <Row label="Down payment" value={fmt(estimate.cashToClose.downPayment)} />
            <Row label="Tennessee transfer tax" value={fmt(estimate.cashToClose.transferTax)} />
            <Row label="Tennessee mortgage tax" value={fmt(estimate.cashToClose.mortgageTax)} />
            <Row label="Other closing costs (estimate range)" value={`${fmt(estimate.cashToClose.otherLow)} – ${fmt(estimate.cashToClose.otherHigh)}`} />
          </dl>
          <p className="mt-4 text-[13px] leading-relaxed text-muted">
            By law the buyer pays the transfer tax and the borrower pays the mortgage tax. Your contract can shift who bears the
            cost. Confirm with your closing attorney or title company. Other closing costs (lender, title, recording, prepaid
            taxes and insurance) are shown as 2%–5% of the price, less the two taxes above.
          </p>
        </div>

        {estimate.warnings.length > 0 && (
          <ul className={`${resultTileClass} space-y-1 text-[15px]`}>
            {estimate.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt>{label}</dt>
      <dd className="shrink-0 tabular-nums">{value}</dd>
    </div>
  );
}

const inputClass =
  "min-h-12 w-full rounded-lg border border-ink/20 bg-white px-4 text-base tabular-nums focus:border-forest focus:outline-none focus:ring-2 focus:ring-forest/20";
const selectClass = `mt-2 ${inputClass}`;

function MoneyInput({ id, value, onChange, describedBy }: { id: string; value: number; onChange: (n: number) => void; describedBy?: string }) {
  return (
    <div className="relative mt-2">
      <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-muted" aria-hidden="true">
        $
      </span>
      <input
        id={id}
        inputMode="numeric"
        value={value ? Math.round(value).toLocaleString("en-US") : ""}
        placeholder="0"
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ""));
          onChange(Number.isFinite(n) ? Math.min(n, 20_000_000) : 0);
        }}
        aria-describedby={describedBy}
        className={`${inputClass} pl-8`}
      />
    </div>
  );
}

function SuffixInput({
  id,
  value,
  suffix,
  step,
  max,
  onChange,
  describedBy,
}: {
  id: string;
  value: number;
  suffix: string;
  step: number;
  max: number;
  onChange: (n: number) => void;
  describedBy?: string;
}) {
  return (
    <div className="relative mt-2">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={0}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => {
          const n = e.target.value === "" ? 0 : Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.min(max, Math.max(0, n)));
        }}
        aria-describedby={describedBy}
        className={`${inputClass} pr-24`}
      />
      <span className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[14px] text-muted" aria-hidden="true">
        {suffix}
      </span>
    </div>
  );
}

/** A row of radio buttons styled as a segmented control; arrow keys move between options. */
function Segmented<T extends string>({
  label,
  labelledBy,
  value,
  options,
  onChange,
}: {
  label: string;
  labelledBy?: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  const name = useId();
  return (
    <div role="radiogroup" aria-label={labelledBy ? undefined : label} aria-labelledby={labelledBy} className="inline-flex rounded-lg border border-ink/20 p-1">
      {options.map((o) => (
        <label
          key={o.value}
          className={`flex min-h-10 cursor-pointer items-center rounded-md px-4 text-[15px] font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-forest ${value === o.value ? "bg-forest text-white" : "text-ink hover:text-forest"}`}
        >
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="sr-only" />
          {o.label}
        </label>
      ))}
    </div>
  );
}

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  annualPropertyTax,
  conventionalPmiMonthly,
  estimateBuyerCosts,
  fhaAnnualMipRate,
  fhaUpfrontPremium,
  monthlyPrincipalAndInterest,
  mortgageTax,
  transferTax,
  vaFundingFeeRate,
} from "./calc.ts";
import { LOAN_RULES as rules } from "./rates.ts";

test("principal and interest", () => {
  assert.equal(monthlyPrincipalAndInterest(360_000, 6.5, 30), 2275.44);
  assert.equal(monthlyPrincipalAndInterest(120_000, 0, 30), 333.33);
  assert.equal(monthlyPrincipalAndInterest(0, 6.5, 30), 0);
});

test("Tennessee property tax: 25% assessment times the rate per $100", () => {
  assert.equal(annualPropertyTax(400_000, 2.814, 0.25), 2814);
  assert.equal(annualPropertyTax(300_000, 3.11, 0.25), 2332.5);
  assert.equal(annualPropertyTax(0, 3.11, 0.25), 0);
});

test("transfer tax and mortgage tax", () => {
  assert.equal(transferTax(400_000, 0.37), 1480);
  assert.equal(mortgageTax(360_000, 0.115, 2000), 411.7);
  assert.equal(mortgageTax(1_500, 0.115, 2000), 0);
  assert.equal(mortgageTax(2_000, 0.115, 2000), 0);
});

test("conventional PMI only above 80% loan-to-value", () => {
  assert.equal(conventionalPmiMonthly(360_000, 400_000, rules.conventional), 180);
  assert.equal(conventionalPmiMonthly(320_000, 400_000, rules.conventional), 0);
});

test("FHA premiums by term, loan size, and LTV", () => {
  assert.equal(fhaUpfrontPremium(289_500, rules.fha), 5066.25);
  assert.equal(fhaAnnualMipRate(289_500, 0.965, 30, rules.fha), 0.0055);
  assert.equal(fhaAnnualMipRate(289_500, 0.9, 30, rules.fha), 0.005);
  assert.equal(fhaAnnualMipRate(800_000, 0.965, 30, rules.fha), 0.0075);
  assert.equal(fhaAnnualMipRate(289_500, 0.95, 15, rules.fha), 0.004);
  assert.equal(fhaAnnualMipRate(800_000, 0.75, 15, rules.fha), 0.0015);
});

test("VA funding fee tiers and exemption", () => {
  assert.equal(vaFundingFeeRate(0, "first", rules.va), 0.0215);
  assert.equal(vaFundingFeeRate(0.049, "subsequent", rules.va), 0.033);
  assert.equal(vaFundingFeeRate(0.05, "subsequent", rules.va), 0.015);
  assert.equal(vaFundingFeeRate(0.1, "first", rules.va), 0.0125);
  assert.equal(vaFundingFeeRate(0, "exempt", rules.va), 0);
});

test("worked example 1: $400,000 conventional, 10% down, 6.5%, 30 years, rate 2.814", () => {
  const e = estimateBuyerCosts(
    { price: 400_000, downPayment: 40_000, ratePercent: 6.5, termYears: 30, loanType: "conventional", vaUse: "first", taxRatePer100: 2.814, insuranceYearly: 1_649, hoaMonthly: 0 },
    rules,
  );
  assert.equal(e.totalLoan, 360_000);
  assert.equal(e.monthly.principalAndInterest, 2275.44);
  assert.equal(e.monthly.propertyTax, 234.5);
  assert.equal(e.monthly.mortgageInsurance, 180);
  assert.equal(e.monthly.insurance, 137.42);
  assert.equal(e.monthly.total, 2827.36);
  assert.equal(e.cashToClose.transferTax, 1480);
  assert.equal(e.cashToClose.mortgageTax, 411.7);
  // 2% and 5% of price, less the two taxes already shown.
  assert.equal(e.cashToClose.otherLow, 6108.3);
  assert.equal(e.cashToClose.otherHigh, 18108.3);
  assert.equal(e.cashToClose.totalLow, 48_000);
  assert.equal(e.cashToClose.totalHigh, 60_000);
});

test("worked example 2: $300,000 FHA, 3.5% down, rate 3.11", () => {
  const e = estimateBuyerCosts(
    { price: 300_000, downPayment: 10_500, ratePercent: 6.25, termYears: 30, loanType: "fha", vaUse: "first", taxRatePer100: 3.11, insuranceYearly: 0, hoaMonthly: 0 },
    rules,
  );
  assert.equal(e.baseLoan, 289_500);
  assert.equal(e.financedFee, 5066.25);
  assert.equal(e.totalLoan, 294_566.25);
  assert.equal(e.monthly.mortgageInsurance, 132.69);
  assert.equal(e.monthly.propertyTax, 194.38);
  assert.equal(e.cashToClose.transferTax, 1110);
  assert.equal(e.cashToClose.mortgageTax, 336.45);
  assert.deepEqual(e.warnings, []);
});

test("worked example 3: $350,000 VA first use, no down payment, rate 1.566", () => {
  const e = estimateBuyerCosts(
    { price: 350_000, downPayment: 0, ratePercent: 6, termYears: 30, loanType: "va", vaUse: "first", taxRatePer100: 1.566, insuranceYearly: 0, hoaMonthly: 150 },
    rules,
  );
  assert.equal(e.financedFee, 7525);
  assert.equal(e.totalLoan, 357_525);
  assert.equal(e.monthly.mortgageInsurance, 0);
  assert.equal(e.monthly.propertyTax, 114.19);
  assert.equal(e.monthly.hoa, 150);
  assert.equal(e.cashToClose.transferTax, 1295);
  assert.equal(e.cashToClose.mortgageTax, 408.85);
  assert.equal(e.cashToClose.downPayment, 0);
});

test("VA exempt pays no funding fee; low down payments warn", () => {
  const va = estimateBuyerCosts(
    { price: 350_000, downPayment: 0, ratePercent: 6, termYears: 30, loanType: "va", vaUse: "exempt", taxRatePer100: 1.566, insuranceYearly: 0, hoaMonthly: 0 },
    rules,
  );
  assert.equal(va.financedFee, 0);
  assert.equal(va.totalLoan, 350_000);
  const fha = estimateBuyerCosts(
    { price: 300_000, downPayment: 3_000, ratePercent: 6, termYears: 30, loanType: "fha", vaUse: "first", taxRatePer100: 3, insuranceYearly: 0, hoaMonthly: 0 },
    rules,
  );
  assert.equal(fha.warnings.length, 1);
});

test("tax table: every county we serve, sane rates, unique ids, sources on every area", async () => {
  const { COUNTY_TAX, combinedRate } = await import("./rates.ts");
  const counties = ["Davidson", "Williamson", "Rutherford", "Sumner", "Wilson", "Maury", "Montgomery", "Robertson", "Cheatham", "Dickson"];
  assert.deepEqual(COUNTY_TAX.map((c) => c.county).sort(), [...counties].sort());
  const ids = new Set<string>();
  for (const c of COUNTY_TAX) {
    assert.ok(c.outside.length > 0, `${c.county} needs an outside-city area`);
    for (const a of [...c.outside, ...c.cities]) {
      assert.ok(!ids.has(a.id), `duplicate id ${a.id}`);
      ids.add(a.id);
      const rate = combinedRate(a);
      assert.ok(rate > 0.5 && rate < 5, `${a.id} rate ${rate} out of range`);
      assert.ok(a.sources.length > 0 && a.sources.every((s) => s.url.startsWith("https://")), `${a.id} needs https sources`);
    }
  }
  assert.equal(combinedRate(COUNTY_TAX.find((c) => c.county === "Davidson")!.cities.find((a) => a.id === "nashville-usd")!), 2.814);
});

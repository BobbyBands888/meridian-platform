// Buyer cost math for the /buy/calculator page. Pure functions with no imports: every rate comes in as an argument
// (the figures and their sources live in lib/buyer-costs/rates.ts), so `node --test` can run calc.test.ts directly and
// the same code runs in the browser.
//
// Estimates only. Money results are rounded to cents.

export type LoanType = "conventional" | "fha" | "va";
/** VA funding fee tier: first use of the benefit, a later use, or exempt from the fee. */
export type VaUse = "first" | "subsequent" | "exempt";

/** A rate that applies up to and including `maxLtv` (loan-to-value, 0–1). The last band uses Infinity. */
export type LtvBand = { maxLtv: number; rate: number };

export type LoanRules = {
  /** Residential assessment ratio (Tennessee: 0.25). */
  assessmentRatio: number;
  /** Realty transfer tax, dollars per $100 of price. */
  transferTaxPer100: number;
  /** Mortgage recordation (indebtedness) tax, dollars per $100 of principal. */
  mortgageTaxPer100: number;
  /** Principal exempt from the mortgage tax. */
  mortgageTaxExempt: number;
  conventional: {
    /** Assumed annual PMI as a share of the loan, charged while the loan is over `pmiMaxLtv` of the price. */
    pmiAnnualRate: number;
    pmiMaxLtv: number;
    minDown: number;
  };
  fha: {
    upfrontRate: number;
    minDown: number;
    /** Base loan amount above which the higher annual premium applies. */
    highBalanceThreshold: number;
    /** Annual premium bands for terms over 15 years, at or under the threshold and above it. */
    annualLongTerm: { standard: LtvBand[]; highBalance: LtvBand[] };
    /** Annual premium bands for terms of 15 years or less. */
    annualShortTerm: { standard: LtvBand[]; highBalance: LtvBand[] };
  };
  va: {
    /** Funding fee by minimum down payment share, highest minimum first. */
    firstUse: { minDown: number; rate: number }[];
    subsequentUse: { minDown: number; rate: number }[];
  };
  /** Typical total closing costs as a share of price (low, high), including the two Tennessee taxes. */
  closingCostRange: [number, number];
};

export type CostInputs = {
  price: number;
  /** Down payment in dollars. */
  downPayment: number;
  /** Annual interest rate as a percent, e.g. 6.5. */
  ratePercent: number;
  termYears: 15 | 30;
  loanType: LoanType;
  vaUse: VaUse;
  /** Combined property tax rate per $100 of assessed value (county + city + districts). */
  taxRatePer100: number;
  /** Yearly homeowners insurance, dollars. */
  insuranceYearly: number;
  /** Monthly HOA dues, dollars. */
  hoaMonthly: number;
};

export const roundCents = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Monthly principal and interest on a fixed-rate loan. */
export function monthlyPrincipalAndInterest(loan: number, ratePercent: number, termYears: number) {
  if (loan <= 0) return 0;
  const n = termYears * 12;
  const r = ratePercent / 100 / 12;
  if (r === 0) return roundCents(loan / n);
  return roundCents((loan * r) / (1 - Math.pow(1 + r, -n)));
}

/** Yearly property tax the Tennessee way: appraised value × assessment ratio × rate per $100 of assessed value. */
export function annualPropertyTax(appraisedValue: number, ratePer100: number, assessmentRatio: number) {
  if (appraisedValue <= 0 || ratePer100 <= 0) return 0;
  return roundCents(((appraisedValue * assessmentRatio) / 100) * ratePer100);
}

/** Realty transfer tax on the price. (The law taxes the greater of price or value; the price is our only figure.) */
export function transferTax(price: number, per100: number) {
  return price > 0 ? roundCents((price / 100) * per100) : 0;
}

/** Mortgage recordation tax on principal above the exempt amount. */
export function mortgageTax(principal: number, per100: number, exempt: number) {
  const taxable = principal - exempt;
  return taxable > 0 ? roundCents((taxable / 100) * per100) : 0;
}

/** Monthly conventional PMI under the stated assumption; 0 at or under the LTV cutoff (20% or more down). */
export function conventionalPmiMonthly(loan: number, price: number, rules: LoanRules["conventional"]) {
  if (loan <= 0 || price <= 0 || loan / price <= rules.pmiMaxLtv) return 0;
  return roundCents((loan * rules.pmiAnnualRate) / 12);
}

const bandRate = (bands: LtvBand[], ltv: number) => (bands.find((b) => ltv <= b.maxLtv) ?? bands[bands.length - 1]).rate;

/** FHA upfront mortgage insurance premium on the base loan. */
export function fhaUpfrontPremium(baseLoan: number, rules: LoanRules["fha"]) {
  return baseLoan > 0 ? roundCents(baseLoan * rules.upfrontRate) : 0;
}

/** FHA annual MIP rate for a base loan, its LTV (base loan ÷ price), and the term. */
export function fhaAnnualMipRate(baseLoan: number, ltv: number, termYears: number, rules: LoanRules["fha"]) {
  const table = termYears > 15 ? rules.annualLongTerm : rules.annualShortTerm;
  return bandRate(baseLoan > rules.highBalanceThreshold ? table.highBalance : table.standard, ltv);
}

/** Monthly FHA MIP, figured on the base loan amount (HUD uses the average yearly balance, so this runs slightly high). */
export function fhaMonthlyMip(baseLoan: number, price: number, termYears: number, rules: LoanRules["fha"]) {
  if (baseLoan <= 0 || price <= 0) return 0;
  return roundCents((baseLoan * fhaAnnualMipRate(baseLoan, baseLoan / price, termYears, rules)) / 12);
}

/** VA funding fee rate for a down payment share and benefit use. Exempt borrowers pay none. */
export function vaFundingFeeRate(downShare: number, use: VaUse, rules: LoanRules["va"]) {
  if (use === "exempt") return 0;
  const table = use === "first" ? rules.firstUse : rules.subsequentUse;
  return (table.find((t) => downShare >= t.minDown) ?? table[table.length - 1]).rate;
}

export type CostEstimate = {
  baseLoan: number;
  /** FHA upfront premium or VA funding fee, financed into the loan. */
  financedFee: number;
  financedFeeLabel: string | null;
  totalLoan: number;
  monthly: { principalAndInterest: number; propertyTax: number; insurance: number; mortgageInsurance: number; hoa: number; total: number };
  mortgageInsuranceLabel: string | null;
  cashToClose: {
    downPayment: number;
    transferTax: number;
    mortgageTax: number;
    /** Everything else (lender, title, recording, prepaids), as a range. */
    otherLow: number;
    otherHigh: number;
    totalLow: number;
    totalHigh: number;
  };
  warnings: string[];
};

/** The whole estimate: monthly payment breakdown and cash to close. */
export function estimateBuyerCosts(input: CostInputs, rules: LoanRules): CostEstimate {
  const price = Math.max(0, input.price);
  const down = Math.min(Math.max(0, input.downPayment), price);
  const downShare = price > 0 ? down / price : 0;
  const baseLoan = roundCents(price - down);
  const warnings: string[] = [];

  let financedFee = 0;
  let financedFeeLabel: string | null = null;
  let mortgageInsurance = 0;
  let mortgageInsuranceLabel: string | null = null;

  if (input.loanType === "conventional") {
    mortgageInsurance = conventionalPmiMonthly(baseLoan, price, rules.conventional);
    if (mortgageInsurance > 0) mortgageInsuranceLabel = "PMI (assumed rate)";
    if (price > 0 && downShare < rules.conventional.minDown) warnings.push("Conventional loans usually need at least 3% down.");
  } else if (input.loanType === "fha") {
    financedFee = fhaUpfrontPremium(baseLoan, rules.fha);
    financedFeeLabel = "FHA upfront mortgage insurance premium";
    mortgageInsurance = fhaMonthlyMip(baseLoan, price, input.termYears, rules.fha);
    mortgageInsuranceLabel = "FHA annual MIP";
    if (price > 0 && downShare < rules.fha.minDown) warnings.push("FHA loans usually need at least 3.5% down.");
  } else {
    const rate = vaFundingFeeRate(downShare, input.vaUse, rules.va);
    financedFee = roundCents(baseLoan * rate);
    financedFeeLabel = rate > 0 ? "VA funding fee" : null;
  }

  const totalLoan = roundCents(baseLoan + financedFee);
  const principalAndInterest = monthlyPrincipalAndInterest(totalLoan, input.ratePercent, input.termYears);
  const propertyTax = roundCents(annualPropertyTax(price, input.taxRatePer100, rules.assessmentRatio) / 12);
  const insurance = roundCents(Math.max(0, input.insuranceYearly) / 12);
  const hoa = roundCents(Math.max(0, input.hoaMonthly));

  const transfer = transferTax(price, rules.transferTaxPer100);
  const mortgage = mortgageTax(totalLoan, rules.mortgageTaxPer100, rules.mortgageTaxExempt);
  // The typical range already includes both taxes, so they're taken out of it rather than counted twice.
  const other = (share: number) => roundCents(Math.max(0, price * share - transfer - mortgage));
  const otherLow = other(rules.closingCostRange[0]);
  const otherHigh = other(rules.closingCostRange[1]);
  const fixed = roundCents(down + transfer + mortgage);

  return {
    baseLoan,
    financedFee,
    financedFeeLabel,
    totalLoan,
    monthly: {
      principalAndInterest,
      propertyTax,
      insurance,
      mortgageInsurance,
      hoa,
      total: roundCents(principalAndInterest + propertyTax + insurance + mortgageInsurance + hoa),
    },
    mortgageInsuranceLabel,
    cashToClose: {
      downPayment: down,
      transferTax: transfer,
      mortgageTax: mortgage,
      otherLow,
      otherHigh,
      totalLow: roundCents(fixed + otherLow),
      totalHigh: roundCents(fixed + otherHigh),
    },
    warnings,
  };
}

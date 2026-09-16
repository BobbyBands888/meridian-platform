/** Written paragraphs for one area page, shown under the page intro. */
export type AreaContent = { paragraphs: string[] };

export type MarketAreaContent = {
  /** Keyed by area slug ("spring-hill"). */
  pages: Record<string, AreaContent>;
  /**
   * Counties whose area pages stay out of search (noindex, left out of the sitemap) until they have written content,
   * so a new county doesn't add a page per ZIP that only repeats the template intro.
   */
  contentRequiredCounties: string[];
};

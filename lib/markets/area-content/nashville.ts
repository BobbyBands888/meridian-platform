import type { MarketAreaContent } from "./types";

// Area page content for the counties added on 2026-09-16. General facts only: no prices, statistics, or school
// ratings. Every other area in these counties is noindexed until it has content here.
// TODO: pleasant-view needs content before it can be indexed.

export const nashville: MarketAreaContent = {
  contentRequiredCounties: ["Maury", "Montgomery", "Robertson", "Cheatham", "Dickson"],
  pages: {
    clarksville: {
      paragraphs: [
        "Clarksville is the Montgomery County seat, northwest of Nashville along I-24, where the Red River meets the Cumberland River. Austin Peay State University is near downtown.",
        "Fort Campbell, home of the Army's 101st Airborne Division, sits just north of the city on the Tennessee–Kentucky line, so many buyers here are military families moving on orders. Expect some offers with VA loans: the VA appraisal checks a home against the VA's minimum property requirements, and repairs it calls for often have to be finished before closing.",
        "Homes here are assessed by Montgomery County, so pull sale history for comps from the Montgomery County assessor's records rather than Davidson County's.",
      ],
    },
    "spring-hill": {
      paragraphs: [
        "Spring Hill straddles the Maury–Williamson county line south of Franklin, between I-65 and US-31. Most of ZIP 37174 is in Maury County and part is in Williamson, and the county your home is in sets your property tax, your assessor, and your public school district.",
        "The town grew around General Motors' Spring Hill plant, built for Saturn, and Saturn Parkway still connects it to I-65. Its history goes back further: the 1864 Battle of Spring Hill was fought here, and Rippavilla, a plantation house from the same era, stands on US-31.",
        "Check your deed or the county assessor's site before you list, and name the right county in your listing so buyers comparing districts get the correct answer.",
      ],
    },
    columbia: {
      paragraphs: [
        "Columbia is the Maury County seat, on the Duck River south of Spring Hill along US-31. Downtown is built around the courthouse square, and Columbia State Community College has its main campus here.",
        "The President James K. Polk Home, the only surviving residence of the 11th president other than the White House, is downtown. Every spring the city hosts Mule Day, the festival behind its \"Mule Capital of the World\" nickname.",
        "Many houses near downtown were built before 1978. If yours was, federal law requires a lead-based paint disclosure and the EPA pamphlet in addition to Tennessee's condition disclosure.",
      ],
    },
    springfield: {
      paragraphs: [
        "Springfield is the Robertson County seat, north of Nashville on US-41 and US-431, with a courthouse square at its center.",
        "Robertson County has long been farm country, known for dark-fired tobacco, and much of the land around Springfield is still rural. ZIP 37172 reaches well beyond city limits into that countryside.",
        "Outside city limits, some homes are on septic systems or wells rather than city utilities. If yours is, have the records ready: buyers, inspectors, and lenders commonly ask about them.",
      ],
    },
    "white-house": {
      paragraphs: [
        "White House sits on I-65 and US-31W north of Nashville, and the city straddles the Sumner–Robertson county line. ZIP 37188 covers land in both counties.",
        "Because of that line, two homes a few streets apart can have different property tax rates, assessors, and public school districts. Confirm which county your home is in before you list, and say so in the listing so buyers don't have to guess.",
      ],
    },
    "ashland-city": {
      paragraphs: [
        "Ashland City is the Cheatham County seat, on the Cumberland River northwest of Nashville along TN-12. The Cumberland River Bicentennial Trail, a rail-trail along the river, starts just outside town.",
        "Low ground near the Cumberland and its creeks can fall inside a FEMA flood zone. Look up your address on FEMA's Flood Map Service Center before listing: Tennessee's disclosure form asks about flooding, and lenders require flood insurance on a home in a high-risk zone, which buyers will want to price in.",
      ],
    },
    "kingston-springs": {
      paragraphs: [
        "Kingston Springs is a small Cheatham County town on I-40 west of Nashville, along the Harpeth River. The Narrows of the Harpeth, part of Harpeth River State Park, is nearby, and the river draws paddlers through the warmer months. Pegram, the next town toward Nashville, has its own ZIP.",
        "Many homes here sit on wooded, hilly lots, and some outside town use septic systems. Flood maps matter near the Harpeth too, so check FEMA's Flood Map Service Center for your address before you fill out the disclosure form.",
      ],
    },
    dickson: {
      paragraphs: [
        "Dickson is the largest city in Dickson County, west of Nashville along I-40 and TN-46. The county seat is Charlotte, a short drive north.",
        "Montgomery Bell State Park is just east in Burns, and downtown's Clement Railroad Hotel Museum honors Governor Frank G. Clement, who was born in Dickson.",
        "ZIP 37055 reaches far past city limits, so a Dickson mailing address doesn't always mean city water, sewer, or city property tax. Check whether your home is inside the city before describing utilities and taxes in your listing.",
      ],
    },
  },
};

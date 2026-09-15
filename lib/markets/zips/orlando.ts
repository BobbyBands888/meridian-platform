import type { MarketZipData, ZipInfo } from "./types";

// Residential ZIP codes Orlando Buys serves across Central Florida: Orange, Seminole, and Osceola counties. Each has
// the mailing city and a common area name. Area names are approximate (ZIP lines don't follow neighborhood lines),
// and a few ZIPs cross county lines; `county` is the primary one. PO-box-only, resort, and campus ZIPs are left out.

const z = (city: string, county: string, area = city): ZipInfo => ({ city, area, county });

const zips: Record<string, ZipInfo> = {
  // Orange County
  "32703": z("Apopka", "Orange"),
  "32709": z("Christmas", "Orange"),
  "32712": z("Apopka", "Orange"),
  "32751": z("Maitland", "Orange"),
  "32789": z("Winter Park", "Orange"),
  "32792": z("Winter Park", "Orange"),
  "32798": z("Zellwood", "Orange"),
  "32801": z("Orlando", "Orange", "Downtown Orlando"),
  "32803": z("Orlando", "Orange", "Colonialtown and Audubon Park"),
  "32804": z("Orlando", "Orange", "College Park"),
  "32805": z("Orlando", "Orange", "Parramore and Washington Shores"),
  "32806": z("Orlando", "Orange", "Delaney Park and SoDo"),
  "32807": z("Orlando", "Orange", "Azalea Park"),
  "32808": z("Orlando", "Orange", "Pine Hills"),
  "32809": z("Orlando", "Orange", "Pine Castle"),
  "32810": z("Orlando", "Orange", "Lockhart"),
  "32811": z("Orlando", "Orange", "MetroWest"),
  "32812": z("Orlando", "Orange", "Conway and Belle Isle"),
  "32814": z("Orlando", "Orange", "Baldwin Park"),
  "32817": z("Orlando", "Orange", "Union Park"),
  "32818": z("Orlando", "Orange", "Hiawassee"),
  "32819": z("Orlando", "Orange", "Dr. Phillips"),
  "32820": z("Orlando", "Orange", "Bithlo"),
  "32821": z("Orlando", "Orange", "Williamsburg"),
  "32822": z("Orlando", "Orange", "Southeast Orlando"),
  "32824": z("Orlando", "Orange", "Meadow Woods"),
  "32825": z("Orlando", "Orange", "East Orlando"),
  "32826": z("Orlando", "Orange", "UCF Area"),
  "32827": z("Orlando", "Orange", "Lake Nona"),
  "32828": z("Orlando", "Orange", "Avalon Park"),
  "32829": z("Orlando", "Orange", "Southeast Orlando"),
  "32832": z("Orlando", "Orange", "Lake Nona"),
  "32833": z("Orlando", "Orange", "Wedgefield"),
  "32835": z("Orlando", "Orange", "West Orlando"),
  "32836": z("Orlando", "Orange", "Bay Hill"),
  "32837": z("Orlando", "Orange", "Hunter's Creek"),
  "32839": z("Orlando", "Orange", "Oak Ridge"),
  "34734": z("Gotha", "Orange"),
  "34760": z("Oakland", "Orange"),
  "34761": z("Ocoee", "Orange"),
  "34786": z("Windermere", "Orange"),
  "34787": z("Winter Garden", "Orange"),

  // Seminole County
  "32701": z("Altamonte Springs", "Seminole"),
  "32707": z("Casselberry", "Seminole"),
  "32708": z("Winter Springs", "Seminole"),
  "32714": z("Altamonte Springs", "Seminole"),
  "32730": z("Casselberry", "Seminole", "Fern Park"),
  "32732": z("Geneva", "Seminole"),
  "32746": z("Lake Mary", "Seminole"),
  "32750": z("Longwood", "Seminole"),
  "32765": z("Oviedo", "Seminole"),
  "32766": z("Oviedo", "Seminole", "Chuluota"),
  "32771": z("Sanford", "Seminole"),
  "32773": z("Sanford", "Seminole"),
  "32779": z("Longwood", "Seminole"),

  // Osceola County
  "34739": z("Kenansville", "Osceola"),
  "34741": z("Kissimmee", "Osceola"),
  "34743": z("Kissimmee", "Osceola", "Buenaventura Lakes"),
  "34744": z("Kissimmee", "Osceola"),
  "34746": z("Kissimmee", "Osceola"),
  "34747": z("Celebration", "Osceola"),
  "34758": z("Kissimmee", "Osceola", "Poinciana"),
  "34769": z("St. Cloud", "Osceola"),
  "34771": z("St. Cloud", "Osceola"),
  "34772": z("St. Cloud", "Osceola"),
  "34773": z("St. Cloud", "Osceola"),
};

export const orlando: MarketZipData = {
  counties: ["Orange", "Seminole", "Osceola"],
  zips,
};

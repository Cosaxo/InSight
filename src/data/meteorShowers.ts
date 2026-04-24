// Major annual meteor showers that are visible from most latitudes.
// Dates are approximate peaks — real peak times drift a day or two year to
// year. Windows include the "active" range around the peak when you might
// still catch meteors.
//
// Source: IMO (International Meteor Organization) working list.

import type { MeteorShower } from "../types";

export const METEOR_SHOWERS: MeteorShower[] = [
  {
    name: "Quadrantids",
    peakMonth: 1,
    peakDay: 4,
    startDay: "12-28",
    endDay: "01-12",
    peakZhr: 110,
    radiant: "Boötes",
  },
  {
    name: "Lyrids",
    peakMonth: 4,
    peakDay: 22,
    startDay: "04-16",
    endDay: "04-30",
    peakZhr: 18,
    radiant: "Lyra",
  },
  {
    name: "Eta Aquariids",
    peakMonth: 5,
    peakDay: 6,
    startDay: "04-19",
    endDay: "05-28",
    peakZhr: 50,
    radiant: "Aquarius",
  },
  {
    name: "Perseids",
    peakMonth: 8,
    peakDay: 12,
    startDay: "07-17",
    endDay: "08-24",
    peakZhr: 100,
    radiant: "Perseus",
  },
  {
    name: "Orionids",
    peakMonth: 10,
    peakDay: 21,
    startDay: "10-02",
    endDay: "11-07",
    peakZhr: 23,
    radiant: "Orion",
  },
  {
    name: "Leonids",
    peakMonth: 11,
    peakDay: 17,
    startDay: "11-06",
    endDay: "11-30",
    peakZhr: 15,
    radiant: "Leo",
  },
  {
    name: "Geminids",
    peakMonth: 12,
    peakDay: 14,
    startDay: "12-04",
    endDay: "12-17",
    peakZhr: 150,
    radiant: "Gemini",
  },
  {
    name: "Ursids",
    peakMonth: 12,
    peakDay: 22,
    startDay: "12-17",
    endDay: "12-26",
    peakZhr: 10,
    radiant: "Ursa Minor",
  },
];

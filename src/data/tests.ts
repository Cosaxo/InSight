// Test question banks. `dir` encodes agreement direction:
//   +1 means agreeing pushes the axis positive
//   -1 means agreeing pushes the axis negative

export interface PersonalityQ {
  t: number; // 0..4 → O, C, E, A, R
  text: string;
  dir: 1 | -1;
}

export interface PoliticalQ {
  axis: "econ" | "social";
  dir: 1 | -1;
  text: string;
}

export interface ValuesQ {
  axis: "indiv" | "change";
  dir: 1 | -1;
  text: string;
}

export const BIG5_Q: PersonalityQ[] = [
  { t: 0, text: "I enjoy exploring unconventional and new ideas", dir: 1 },
  { t: 0, text: "I prefer sticking to familiar routines", dir: -1 },
  { t: 1, text: "I complete tasks thoroughly and on schedule", dir: 1 },
  { t: 1, text: "I often act on impulse without planning ahead", dir: -1 },
  { t: 2, text: "I feel energised after spending time with people", dir: 1 },
  {
    t: 2,
    text: "I prefer quiet evenings alone over social gatherings",
    dir: -1,
  },
  { t: 3, text: "I find it easy to empathise with others", dir: 1 },
  { t: 3, text: "I tend to prioritise my own needs over others'", dir: -1 },
  { t: 4, text: "I stay calm and grounded under pressure", dir: 1 },
  { t: 4, text: "I find it hard to bounce back from setbacks", dir: -1 },
];

export const POL_Q: PoliticalQ[] = [
  {
    axis: "econ",
    dir: -1,
    text: "Governments should provide a universal basic income",
  },
  {
    axis: "econ",
    dir: 1,
    text: "Free markets produce better outcomes than state planning",
  },
  {
    axis: "econ",
    dir: -1,
    text: "Wealthy individuals should pay significantly higher taxes",
  },
  {
    axis: "econ",
    dir: 1,
    text: "Most services work better when run privately",
  },
  {
    axis: "econ",
    dir: -1,
    text: "Reducing inequality should be a core government priority",
  },
  {
    axis: "social",
    dir: -1,
    text: "Individual freedoms should rarely be limited by the state",
  },
  {
    axis: "social",
    dir: 1,
    text: "Strong social rules protect communities from harm",
  },
  {
    axis: "social",
    dir: -1,
    text: "Drug use is a personal choice and should not be criminal",
  },
  {
    axis: "social",
    dir: 1,
    text: "National security sometimes requires restricting civil liberties",
  },
  {
    axis: "social",
    dir: -1,
    text: "People should be free to live any lifestyle they choose",
  },
];

export const CV_Q: ValuesQ[] = [
  {
    axis: "indiv",
    dir: -1,
    text: "Personal freedom matters more than social conformity",
  },
  {
    axis: "indiv",
    dir: 1,
    text: "We have a shared duty to contribute to our community",
  },
  {
    axis: "indiv",
    dir: -1,
    text: "People should be free to live however they choose without social pressure",
  },
  {
    axis: "indiv",
    dir: 1,
    text: "Sometimes personal interests must yield to the collective good",
  },
  {
    axis: "indiv",
    dir: -1,
    text: "Self-reliance is more valuable than depending on collective support",
  },
  {
    axis: "change",
    dir: 1,
    text: "Disrupting existing institutions is necessary for real progress",
  },
  {
    axis: "change",
    dir: -1,
    text: "Traditions carry wisdom that should not be discarded lightly",
  },
  {
    axis: "change",
    dir: 1,
    text: "The world will be better if we embrace disruption over caution",
  },
  {
    axis: "change",
    dir: -1,
    text: "Rapid change tends to create more problems than it solves",
  },
  {
    axis: "change",
    dir: 1,
    text: "Innovation should be embraced even when it threatens established ways",
  },
];

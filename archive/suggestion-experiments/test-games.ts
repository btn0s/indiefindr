// Test games with known good/bad suggestions for validation

export const TEST_CASES = [
  {
    name: "Mouthwashing",
    appid: 2475490,
    expectedVibes: ["Psychological Horror", "Horror", "Dark", "Surreal", "Walking Simulator"],
    knownBadSuggestions: [
      { appid: 2971750, name: "Homebody Hostess", reason: "Adult visual novel, completely wrong vibe" },
      { appid: 1328840, name: "Lost in Play", reason: "Wholesome family puzzle game" },
    ],
    knownGoodSuggestions: [
      { appid: 1854430, name: "How Fish Is Made", reason: "Same developer, same vibe" },
      { appid: 1670870, name: "Mortuary Assistant", reason: "Horror, atmospheric" },
    ],
  },
  {
    name: "SIGNALIS", 
    appid: 1262350,
    expectedVibes: ["Horror", "Survival Horror", "Sci-Fi", "Atmospheric", "Pixel Graphics"],
    knownBadSuggestions: [],
    knownGoodSuggestions: [
      { appid: 282070, name: "This War of Mine", reason: "Survival, atmospheric" },
    ],
  },
  {
    name: "Noita",
    appid: 881100,
    expectedVibes: ["Roguelike", "Physics", "Pixel Graphics", "Difficult"],
    knownBadSuggestions: [],
    knownGoodSuggestions: [],
  },
];

export type TestCase = typeof TEST_CASES[number];

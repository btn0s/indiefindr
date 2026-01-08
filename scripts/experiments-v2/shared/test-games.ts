export const TEST_GAMES = [
  {
    appid: 1833200,
    title: "DuneCrawl",
    type: "Whimsical adventure",
    description: "DuneCrawl is an open world action-adventure game, where you take to the sandy seas atop a gigantic crustacean festooned with black powder cannons. Play as a solo Crab Keeper, or with a crew of up to three other friends in local and online coop.",
  },
  {
    appid: 3341650,
    title: "PIGFACE",
    type: "Gritty action",
    description: "You wake up with an explosive headache in a pool of your own blood. You're Exit, a terrible woman whose awful past has finally caught up to her. Fulfill contracts for the people who drilled into your skull — guns-blazing, slow and tactical — it doesn't matter. They know you'll do whatever it takes.",
  },
  {
    appid: 1166290,
    title: "Death and Taxes",
    type: "Narrative",
    description: "In this 2D, short narrative-based game, you assume the role of the Grim Reaper... on an office job. Your job is to decide which people are going to live or die. The consequences of your choices are yours to bear, while the mystery of your incarnation awaits revelation!",
  },
  {
    appid: 4037180,
    title: "Go Ape Ship!",
    type: "Party co-op",
    description: "Go Ape Ship! is a frantic co-op multiplayer game for one to eight players. Work with your crew of daring Astrochimps to master an expanding collection of tasks, respond to emergencies, unlock new rooms and upgrades for your spaceship, and safely reach the stars. Survive together. Or not at all.",
  },
  {
    appid: 606160,
    title: "ROUTINE",
    type: "Atmospheric horror",
    description: "ROUTINE is a First Person Sci-Fi Horror set on an abandoned lunar base designed around an 80s vision of the future. Explore and investigate your surroundings as you survive against unknown threats.",
  },
  {
    appid: 2662730,
    title: "Eating Nature",
    type: "Avant-garde",
    description: "Eating Nature is a short experimental game about consumption, nature, and the relationship between the two.",
  },
] as const;

export type TestGame = typeof TEST_GAMES[number];

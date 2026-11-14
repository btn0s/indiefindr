import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import { beforeAll, expect, test } from "vitest";

// Runs the real migrations in an in-process Postgres and checks search_games against real catalog neighbours.
const fixture = JSON.parse(readFileSync("tests/fixtures/search-catalog.json", "utf8")) as { games: [number, string, number, number | null, boolean][] };
// Extras that share a base game's name and outsell it in reviews, so only the base-game rule can put the game first.
const extras: [number, string, number, number | null, boolean][] = [
  [90000001, "A Short Hike - Original Soundtrack", 900000, 98, true],
  [90000002, "Stardew Valley Soundtrack", 900000, 98, true],
  [90000003, "Celeste Demo", 900000, 98, true],
];

const db = new PGlite({ extensions: { pg_trgm, unaccent } });
const top = async (query: string, limit = 8) =>
  (await db.query<{ title: string }>("select title from search_games($1, $2)", [query, limit])).rows.map(row => row.title);

beforeAll(async () => {
  await db.exec("create schema extensions; create role anon; create role authenticated;");
  for (const file of readdirSync("supabase/migrations").sort()) await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  for (const [appid, title, reviews, pct, indie] of [...fixture.games, ...extras])
    await db.query("insert into games(appid, slug, title, review_count, review_positive_pct, is_indie) values ($1, $2, $3, $4, $5, $6)",
      [appid, `g${appid}`, title, reviews, pct, indie]);
}, 60_000);

test.each([
  ["the big walk", "Big Walk"],
  ["stardew", "Stardew Valley"],
  ["hades 2", "Hades II"],
  ["celest", "Celeste"],
  ["a short hike", "A Short Hike"],
  ["hollow night", "Hollow Knight"],
  ["big walk game", "Big Walk"],
  ["dont starve", "Don't Starve"],
  ["roki", "Röki"],
  ["god of war ragnarok", "God of War Ragnarök"],
  ["GOD OF WAR: RAGNARÖK™", "God of War Ragnarök"],
  ["obra dinn", "Return of the Obra Dinn"],
  ["hol", "Hollow Knight"],
])("%s → %s first", async (query, expected) => {
  expect((await top(query))[0]).toBe(expected);
});

test("base games beat their soundtracks and demos", async () => {
  const hike = await top("a short hike");
  expect(hike.indexOf("A Short Hike")).toBeLessThan(hike.indexOf("A Short Hike - Original Soundtrack"));
  const obra = await top("obra dinn");
  expect(obra.slice(0, 2)).toEqual(["Return of the Obra Dinn", "Return of the Obra Dinn - Soundtrack"]);
});

test("normalization", async () => {
  const normalize = async (value: string) => (await db.query<{ n: string }>("select search_normalize($1) as n", [value])).rows[0].n;
  expect(await normalize("The Legend of Zelda™: Breath of the Wild")).toBe("legend of zelda breath of the wild");
  expect(await normalize("Ori & the Will of the Wisps")).toBe("ori and the will of the wisps");
  expect(await normalize("Pokémon® Legends: Z-A")).toBe("pokemon legends z a");
  expect(await normalize("Final Fantasy VII")).toBe("final fantasy 7");
  expect(await normalize("Ведьмак")).toBe("ведьмак");
});

test("empty and punctuation-only queries return nothing", async () => {
  expect(await top("   ")).toEqual([]);
  expect(await top("?!")).toEqual([]);
});

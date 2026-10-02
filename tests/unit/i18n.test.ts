import { test } from "node:test";
import assert from "node:assert/strict";
import { en } from "../../lib/i18n/en.ts";
import { et } from "../../lib/i18n/et.ts";
import { ru } from "../../lib/i18n/ru.ts";

type Tree = { [key: string]: unknown };

function leaves(tree: unknown, path = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (Array.isArray(tree)) {
    tree.forEach((item, i) => leaves(item, `${path}[${i}]`).forEach((v, k) => out.set(k, v)));
  } else if (tree && typeof tree === "object") {
    for (const [key, value] of Object.entries(tree as Tree)) {
      leaves(value, path ? `${path}.${key}` : key).forEach((v, k) => out.set(k, v));
    }
  } else {
    out.set(path, tree);
  }
  return out;
}

const dictionaries = { et, en, ru };
const reference = leaves(et);

for (const [name, dictionary] of Object.entries(dictionaries)) {
  test(`${name}: same keys as Estonian, nothing empty`, () => {
    const own = leaves(dictionary);
    assert.deepEqual([...own.keys()].sort(), [...reference.keys()].sort());
    for (const [key, value] of own) {
      if (typeof value === "string") assert.ok(value.trim().length > 0 || key.endsWith(".label") || key.endsWith(".result"), `${name}.${key} is empty`);
      if (typeof value === "function") {
        const args = key.endsWith("frequency.every") ? [3, "month"] : [3, "x", "y"];
        const text = (value as (...a: unknown[]) => unknown)(...args);
        assert.equal(typeof text, "string", `${name}.${key} must return a string`);
      }
    }
  });
}

test("Russian plurals follow 1 / 2–4 / 5+ (11–14 many)", () => {
  const f = ru.app.sites.installationsCount;
  assert.equal(f(1), "1 электроустановка");
  assert.equal(f(2), "2 электроустановки");
  assert.equal(f(5), "5 электроустановок");
  assert.equal(f(11), "11 электроустановок");
  assert.equal(f(21), "21 электроустановка");
  assert.equal(f(22), "22 электроустановки");
  assert.equal(f(111), "111 электроустановок");
  assert.equal(ru.app.schedule.frequency.every(12, "month"), "Каждые 12 месяцев");
  assert.equal(ru.app.schedule.frequency.every(2, "year"), "Каждые 2 года");
});

test("English and Estonian plurals", () => {
  assert.equal(en.app.members.count(1), "1 member");
  assert.equal(en.app.members.count(4), "4 members");
  assert.equal(et.app.members.count(4), "4 liiget");
});

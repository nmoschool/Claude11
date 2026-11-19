import { test } from "node:test";
import assert from "node:assert/strict";
import { scoreBatch, levelFor, earnedBadges, longestDayStreak, bestStreak, improvedSkills, DAILY_CAP } from "../src/lib/gamification";
import { buildRound, adaptLevel, hintFor, GAME_CODES, type GameContent } from "../src/lib/games";
import { AL_WORDS, TAA_WORDS, NUMBER_WORDS, ANTONYMS, SENTENCES, DICTATION_WORDS } from "../src/lib/gameWords";
import { lamType, taaType } from "../src/lib/vocabGenerators";

const ok = (n: number, hints = 0) => Array.from({ length: n }, () => ({ correct: true, hintsUsed: hints, ms: 2000 }));

test("النقاط: 15 بلا تلميح، 10 بتلميح، مكافأة كل 5 متتالية، ولا خصم", () => {
  assert.deepEqual(scoreBatch(ok(5)).points, [15, 15, 15, 15, 35]);
  assert.deepEqual(scoreBatch(ok(2, 1)).points, [10, 10]);
  assert.deepEqual(scoreBatch([...ok(2), { correct: false, hintsUsed: 0, ms: 1000 }, ...ok(1)]).points, [15, 15, 0, 15]);
  assert.equal(scoreBatch(ok(2), 3).points[1], 35, "السلسلة تستمر من الدفعة السابقة");
});

test("النقاط: الإجابات الأسرع من المعقول لا تُحتسب، والسقف اليومي", () => {
  assert.deepEqual(scoreBatch([{ correct: true, hintsUsed: 0, ms: 50 }]).points, [0]);
  const r = scoreBatch(ok(10), 0, DAILY_CAP - 20);
  assert.equal(r.points.reduce((a, b) => a + b, 0), 20);
});

test("المستويات", () => {
  assert.equal(levelFor(0).title, "برعم");
  assert.equal(levelFor(199).code, "BUD");
  assert.equal(levelFor(200).code, "FLOWER");
  assert.equal(levelFor(400).progress, 50);
  assert.equal(levelFor(5000).next, null);
});

test("الأوسمة وسلاسل الأيام والتحسّن", () => {
  assert.equal(longestDayStreak(["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-05", "2026-11-02"]), 3);
  assert.equal(bestStreak([true, true, false, true, true, true]), 3);
  const before = Array(20).fill(false).map((_, i) => i < 8);
  const after = Array(20).fill(true).map((_, i) => i < 16);
  assert.deepEqual(improvedSkills({ "SPELL.TAA": [...before, ...after], "LEX.NUMBER": [true, false] }), ["SPELL.TAA"]);
  const b = earnedBadges({ totalAttempts: 60, correctBySkillPrefix: { SPELL: 50, LEX: 10, GRAM: 25 }, bestStreak: 10, consecutiveDays: 2, improvedSkills: [], gamesPlayed: 6 });
  assert.deepEqual(b, ["FIRST_STEP", "SPELL_QUEEN", "GRAMMAR_FRIEND", "PERFECT_TEN", "EXPLORER"]);
});

test("المحتوى المدمج صحيح لغوياً وفق القواعد الآلية", () => {
  const sun = AL_WORDS.slice(0, 20), moon = AL_WORDS.slice(20);
  sun.forEach((w) => assert.equal(lamType(w), "SHAMS", w));
  moon.forEach((w) => assert.equal(lamType(w), "QAMAR", w));
  TAA_WORDS.slice(0, 16).forEach((w) => assert.equal(taaType(w), "MARBUTA", w));
  TAA_WORDS.slice(16).forEach((w) => assert.equal(taaType(w.replace(/[ً-ْ]/g, "")), "MAFTUHA", w));
  NUMBER_WORDS.forEach((n) => assert.match(n.dual, /ان$/, n.word));
  SENTENCES.forEach((s) => s.forEach((o) => assert.equal([...o.split(" ")].sort().join(), [...s[0].split(" ")].sort().join(), "نفس الكلمات")));
  assert.equal(new Set(ANTONYMS.flat()).size, ANTONYMS.length * 2);
  assert.equal(DICTATION_WORDS[1].length + DICTATION_WORDS[2].length + DICTATION_WORDS[3].length, 24);
});

const content: GameContent = {
  alWords: AL_WORDS.map((w) => ({ ref: `b:${w}`, word: w })),
  taaWords: TAA_WORDS.map((w) => ({ ref: `b:${w}`, word: w })),
  numberWords: NUMBER_WORDS.map((n) => ({ ref: `b:${n.word}`, ...n })),
  antonyms: ANTONYMS.map(([a, b]) => ({ ref: `b:${a}`, a, b })),
  sentences: SENTENCES.map((o, i) => ({ ref: `s:${i}`, orders: o.map((x) => x.split(" ")) })),
  dictation: ([1, 2, 3] as const).flatMap((l) => DICTATION_WORDS[l].map((w) => ({ ref: `b:${w}`, word: w, level: l }))),
};

test("بناء الجولات لكل لعبة وكل مستوى: الإجابة الصحيحة موجودة دائماً وصحيحة", () => {
  for (const code of GAME_CODES) {
    for (const level of [1, 2, 3] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const r = buildRound(code, content, level, seed, new Set());
        assert.ok(r, `${code} ${level}`);
        if (r.kind === "choice") {
          assert.ok(r.answer >= 0 && r.answer < r.choices.length, `${code}:${r.prompt}`);
          assert.equal(new Set(r.choices).size, r.choices.length, "خيارات غير مكررة");
          if (code === "SHAMS_GARDEN") assert.equal(r.answer, lamType(r.prompt) === "SHAMS" ? 0 : 1);
          if (code === "NUMBER_FACTORY") {
            const n = NUMBER_WORDS.find((x) => x.word === r.prompt)!;
            assert.ok([n.dual, n.plural].includes(r.choices[r.answer]));
          }
        }
        if (r.kind === "order") assert.ok(!r.orders.some((o) => o.join(" ") === r.words.join(" ")), "لا تُعرض مرتبة");
      }
    }
  }
  const m = buildRound("MEMORY_CARDS", content, 3, 5, new Set());
  assert.equal(m!.kind === "memory" && m!.pairs.length, 6);
});

test("الصعوبة التكيفية والتلميح", () => {
  assert.equal(adaptLevel(1, [true, true, true]), 2);
  assert.equal(adaptLevel(3, [true, true, true]), 3);
  assert.equal(adaptLevel(2, [true, false, false]), 1);
  assert.equal(adaptLevel(2, [true, false]), 2);
  const r = buildRound("NUMBER_FACTORY", content, 3, 7, new Set())!;
  const h = hintFor(r);
  assert.ok(r.kind === "choice" && h.removeChoice !== undefined && h.removeChoice !== r.answer);
  assert.equal(hintFor(buildRound("ECHO_DICTATION", content, 1, 1, new Set())!).firstLetter?.length, 1);
});

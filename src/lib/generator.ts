/**
 * مولّد الاختبارات (نقي وحتمي): اختيار متوازن من البنك وفق جدول المواصفات،
 * ونماذج متعددة (أ/ب/ج) بخلط ترتيب الأسئلة والخيارات من بذرة ثابتة —
 * فيُعاد بناء أي نموذج ومفتاحه في أي وقت دون تخزين التبديلات.
 */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function shuffle<T>(arr: T[], rnd: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** تبديل حتمي للفهارس 0..n-1 لسؤال في نموذج */
export function permutation(n: number, seed: number, questionId: string, salt = ""): number[] {
  return shuffle(Array.from({ length: n }, (_, i) => i), mulberry32(seed ^ hashStr(questionId + salt)));
}

export interface PoolQuestion {
  id: string;
  type: string;
  skillCode: string | null;
  difficulty: number;
  points: number;
  parentId: string | null;
  lessonId: string | null;
}

export interface BlueprintRow {
  skillCode?: string | null;
  type?: string | null;
  difficulty?: number | null;
  count: number;
}

export interface PickResult {
  questionIds: string[];
  shortages: { row: number; wanted: number; found: number }[];
}

/**
 * يختار لكل صف من جدول المواصفات أسئلة مطابقة غير مكررة، مع تفضيل التنوع في الدروس.
 * أسئلة نص الفهم (الفرعية) لا تُختار منفردة — يُختار النص بكامل أسئلته عبر type=READING_PASSAGE.
 */
export function pickQuestions(pool: PoolQuestion[], blueprint: BlueprintRow[], seed: number): PickResult {
  const rnd = mulberry32(seed);
  const used = new Set<string>();
  const out: string[] = [];
  const shortages: PickResult["shortages"] = [];
  const children = (pid: string) => pool.filter((q) => q.parentId === pid);

  blueprint.forEach((row, ri) => {
    const candidates = shuffle(
      pool.filter(
        (q) =>
          !used.has(q.id) &&
          (row.type === "READING_PASSAGE" ? q.type === "READING_PASSAGE" : q.parentId === null && q.type !== "READING_PASSAGE") &&
          (!row.type || row.type === q.type) &&
          (!row.skillCode || row.skillCode === q.skillCode || (q.type === "READING_PASSAGE" && children(q.id).some((c) => c.skillCode === row.skillCode))) &&
          (!row.difficulty || row.difficulty === q.difficulty)
      ),
      rnd
    );
    // تنويع الدروس: جولة على الدروس بالتناوب
    const byLesson = new Map<string, PoolQuestion[]>();
    for (const q of candidates) byLesson.set(q.lessonId ?? "-", [...(byLesson.get(q.lessonId ?? "-") ?? []), q]);
    const picked: PoolQuestion[] = [];
    while (picked.length < row.count && [...byLesson.values()].some((l) => l.length)) {
      for (const list of byLesson.values()) {
        if (picked.length >= row.count) break;
        const q = list.shift();
        if (q) picked.push(q);
      }
    }
    for (const q of picked) {
      used.add(q.id);
      out.push(q.id);
      if (q.type === "READING_PASSAGE") {
        for (const c of children(q.id)) {
          used.add(c.id);
          out.push(c.id);
        }
      }
    }
    if (picked.length < row.count) shortages.push({ row: ri, wanted: row.count, found: picked.length });
  });
  return { questionIds: out, shortages };
}

/**
 * ترتيب أسئلة نموذج: يُخلط ترتيب «الكتل» (السؤال المستقل، أو النص مع أسئلته معاً)
 * والنموذج الأول (أ) يحافظ على الترتيب الأصلي.
 */
export function versionOrder(questionIds: string[], parentOf: Record<string, string | null>, seed: number, index: number): string[] {
  const blocks: string[][] = [];
  for (const id of questionIds) {
    const p = parentOf[id];
    if (p && questionIds.includes(p)) {
      const b = blocks.find((x) => x[0] === p);
      if (b) {
        b.push(id);
        continue;
      }
    }
    blocks.push([id]);
  }
  if (index === 0) return blocks.flat();
  return shuffle(blocks, mulberry32(seed + index * 7919)).flat();
}

export const VERSION_LABELS = ["أ", "ب", "ج", "د"];

/** توزيع النماذج على الطالبات بالتناوب حسب الترتيب الأبجدي (المتجاورات بنماذج مختلفة) */
export function versionForStudent(studentIndex: number, versionCount: number): number {
  return studentIndex % Math.max(1, versionCount);
}

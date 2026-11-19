"use client";

/** مؤثرات صوتية لطيفة بلا ملفات (تعمل دون اتصال) + عبارات تشجيع منطوقة */
let ctx: AudioContext | null = null;
function tone(freqs: number[], dur = 0.12) {
  try {
    ctx ??= new AudioContext();
    let t = ctx.currentTime;
    for (const f of freqs) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.9;
    }
  } catch {
    /* الصوت غير متاح */
  }
}
export const sfx = {
  correct: () => tone([660, 880]),
  wrong: () => tone([330, 294], 0.16), // نغمة هادئة غير عقابية
  levelUp: () => tone([523, 659, 784, 1047], 0.1),
  flip: () => tone([520], 0.05),
};

const PRAISE = ["أحسنتِ", "رائع", "ممتاز", "إجابة صحيحة", "بارك الله فيكِ"];
export function say(text: string, rate = 0.85) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ar-SA";
    u.rate = rate;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } catch {
    /* غير مدعوم */
  }
}
export const praise = () => say(PRAISE[Math.floor(Math.random() * PRAISE.length)]);

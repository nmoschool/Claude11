"""يضيف إلقاءً صوتياً بلهجة سعودية فوق الفيديو.

الاستخدام:
    pip install edge-tts
    python3 narrate.py poem_video.mp4 poem_video_voice.mp4 [--voice ar-SA-HamedNeural]

أصوات سعودية متاحة: ar-SA-HamedNeural (رجل)، ar-SA-ZariyahNeural (امرأة).
لاستخدام تسجيلك الخاص بدلاً من الصوت الآلي: ضع ملفات clips/00.mp3 .. clips/13.mp3
(شطر لكل ملف بالترتيب) واستعمل --own.
"""
import argparse, asyncio, json, os, subprocess, sys

sys.path.insert(0, os.path.dirname(__file__))
from poem import BAYT, INTRO, PER

def duration(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                   "-of", "json", path])
    return float(json.loads(out)["format"]["duration"])

async def synth(clips_dir, voice, rate, pitch):
    import edge_tts
    i = 0
    for a, b in BAYT:
        for line in (a, b):
            await edge_tts.Communicate(line, voice, rate=rate, pitch=pitch).save(f"{clips_dir}/{i:02d}.mp3")
            i += 1

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video"); ap.add_argument("out")
    ap.add_argument("--voice", default="ar-SA-HamedNeural")
    ap.add_argument("--rate", default="-18%")
    ap.add_argument("--pitch", default="-4Hz")
    ap.add_argument("--clips", default="clips")
    ap.add_argument("--own", action="store_true", help="use existing recordings in --clips")
    a = ap.parse_args()
    os.makedirs(a.clips, exist_ok=True)
    if not a.own:
        asyncio.run(synth(a.clips, a.voice, a.rate, a.pitch))

    # كل بيت: الصدر يبدأ مع ظهوره، والعجز بعد انتهاء الصدر بوقفة قصيرة
    inputs, delays = [], []
    for k in range(len(BAYT)):
        c1, c2 = f"{a.clips}/{2*k:02d}.mp3", f"{a.clips}/{2*k+1:02d}.mp3"
        t1 = INTRO + k * PER + 0.3
        t2 = max(INTRO + k * PER + 1.8, t1 + duration(c1) + 0.45)
        inputs += [c1, c2]; delays += [t1, t2]

    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-i", a.video]
    for p in inputs: cmd += ["-i", p]
    parts = [f"[{i+1}:a]aresample=44100,adelay={int(d*1000)}:all=1,volume=1.6[v{i}]" for i, d in enumerate(delays)]
    mix = "".join(f"[v{i}]" for i in range(len(inputs)))
    fc = ";".join(parts) + (
        f";{mix}amix=inputs={len(inputs)}:normalize=0,aecho=0.8:0.5:60:0.18,asplit=2[voice][key]"
        ";[0:a]volume=0.8[music];[music][key]sidechaincompress=threshold=0.03:ratio=6:attack=20:release=400[duck]"
        ";[duck][voice]amix=inputs=2:normalize=0,alimiter=limit=0.95[aout]")
    cmd += ["-filter_complex", fc, "-map", "0:v", "-map", "[aout]", "-c:v", "copy", "-c:a", "aac",
            "-b:a", "192k", "-movflags", "+faststart", a.out]
    subprocess.run(cmd, check=True)
    print("done", a.out)

if __name__ == "__main__":
    main()

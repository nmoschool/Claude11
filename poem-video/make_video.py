import math, os, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
S = sys.argv[1] if len(sys.argv) > 1 else HERE
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, "poem_video.mp4")
W, H, FPS = 1080, 1920, 30
AMIRI = f"{HERE}/fonts/Amiri-Bold.ttf"
KUFI = f"{HERE}/fonts/ReemKufi.ttf"

from poem import BAYT, INTRO, PER, OUTRO
DUR = INTRO + PER * len(BAYT) + OUTRO
N = int(DUR * FPS)
rng = np.random.default_rng(7)

# ---------- static layers ----------
yy = np.linspace(0, 1, H)[:, None]

def sky(t):
    """sunset -> dusk -> night as t goes 0..1"""
    top = np.array([[40, 60, 110], [22, 28, 70], [8, 10, 28]], float)
    mid = np.array([[235, 140, 70], [150, 80, 90], [30, 30, 70]], float)
    low = np.array([[255, 200, 120], [220, 120, 80], [70, 50, 80]], float)
    def lerp3(arr):
        k = t * 2
        i = min(int(k), 1); f = k - i
        return arr[i] * (1 - f) + arr[i + 1] * f
    a, b, c = lerp3(top), lerp3(mid), lerp3(low)
    g = np.where(yy < 0.45, a + (b - a) * (yy / 0.45), b + (c - b) * ((yy - 0.45) / 0.25).clip(0, 1))
    return np.broadcast_to(g[:, None, :] if g.ndim == 2 else g, (H, 1, 3))

def dune_layer(base_y, amp, color, seed, width=W * 2):
    r = np.random.default_rng(seed)
    x = np.arange(width)
    y = np.full(width, base_y, float)
    for k in range(4):
        fr = (k + 1) * 2 * math.pi / width * r.integers(1, 3)
        y += amp / (k + 1) * np.sin(x * fr + r.uniform(0, 6.28))
    img = np.zeros((H, width, 4), np.uint8)
    rows = np.arange(H)[:, None]
    mask = rows >= y[None, :]
    shade = ((rows - y[None, :]) / 500).clip(0, 1)
    for ch in range(3):
        img[..., ch] = (color[ch] * (1 - 0.45 * shade)).astype(np.uint8)
    img[..., 3] = mask * 255
    return Image.fromarray(img, "RGBA")

dunes = [  # (image, parallax speed px/s)
    (dune_layer(1250, 70, (150, 90, 70), 1), 6),
    (dune_layer(1420, 90, (120, 68, 50), 2), 14),
    (dune_layer(1600, 110, (80, 45, 35), 3), 26),
]
stars = rng.uniform([0, 0], [W, H * 0.55], (220, 2))
star_b = rng.uniform(0.3, 1, 220)
star_ph = rng.uniform(0, 6.28, 220)
dust = rng.uniform([0, 0], [W, H], (90, 2))

def vignette():
    xx = np.linspace(-1, 1, W)[None, :]
    yv = np.linspace(-1, 1, H)[:, None]
    v = 1 - 0.55 * (xx ** 2 * 0.6 + yv ** 2 * 0.5)
    return v.clip(0.3, 1)[..., None]
VIG = vignette()

# ---------- text ----------
f_line = ImageFont.truetype(AMIRI, 92)
f_title = ImageFont.truetype(KUFI, 120)
f_sub = ImageFont.truetype(KUFI, 52)
f_small = ImageFont.truetype(KUFI, 46)

def text_img(txt, font, fill=(245, 215, 150)):
    d = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    bb = d.textbbox((0, 0), txt, font=font, direction="rtl", language="ar")
    w, h = bb[2] - bb[0] + 60, bb[3] - bb[1] + 60
    im = Image.new("RGBA", (w, h))
    sh = Image.new("RGBA", (w, h))
    ImageDraw.Draw(sh).text((30 - bb[0], 30 - bb[1]), txt, font=font, fill=(0, 0, 0, 220), direction="rtl", language="ar")
    sh = sh.filter(ImageFilter.GaussianBlur(10))
    im.alpha_composite(sh)
    ImageDraw.Draw(im).text((30 - bb[0], 30 - bb[1]), txt, font=font, fill=fill, direction="rtl", language="ar")
    return im

lines = [(text_img(a, f_line), text_img(b, f_line)) for a, b in BAYT]
title = text_img("دروس وتعابير", f_title)
sub = text_img("قصيدة نبطية", f_sub, (230, 200, 160))
outro = text_img("✦  وهاذيك تعطينا دروس وتعابير  ✦".replace("✦", "۞"), f_sub)
num_imgs = [text_img(f"{['الأول','الثاني','الثالث','الرابع','الخامس','السادس','السابع'][i]}", f_small, (230, 190, 130)) for i in range(7)]

def ease(x): x = min(max(x, 0), 1); return x * x * (3 - 2 * x)

def paste(frame, im, cx, cy, alpha, dy=0):
    if alpha <= 0: return
    if alpha < 1:
        im = im.copy(); a = np.array(im.getchannel("A"), float) * alpha
        im.putalpha(Image.fromarray(a.astype(np.uint8)))
    frame.alpha_composite(im, (int(cx - im.width / 2), int(cy - im.height / 2 + dy)))

def ornament(frame, cy, alpha, width):
    if alpha <= 0: return
    d = ImageDraw.Draw(frame)
    c = (235, 195, 120, int(200 * alpha))
    w = int(width * alpha)
    d.line([(W / 2 - w, cy), (W / 2 - 22, cy)], fill=c, width=3)
    d.line([(W / 2 + 22, cy), (W / 2 + w, cy)], fill=c, width=3)
    d.polygon([(W / 2, cy - 12), (W / 2 + 12, cy), (W / 2, cy + 12), (W / 2 - 12, cy)], fill=c)

def render(i):
    t = i / FPS
    p = t / DUR
    bg = np.broadcast_to(sky(p), (H, W, 3)).astype(float).copy()
    # sun sinking / moon rising
    sun_y = 1000 + p * 900
    moon_a = ease((p - 0.35) / 0.3)
    xs = np.arange(W)[None, :]; ys = np.arange(H)[:, None]
    r2 = (xs - 760) ** 2 + (ys - sun_y) ** 2
    glow = np.exp(-r2 / (2 * 260 ** 2)) * (1 - p) * 120
    bg += glow[..., None] * np.array([1, 0.6, 0.25])
    bg[r2 < 95 ** 2] = bg[r2 < 95 ** 2] * 0.2 + np.array([255, 210, 140]) * 0.8 * (1 - p) + bg[r2 < 95 ** 2] * 0.8 * p
    # stars
    img = Image.fromarray(bg.clip(0, 255).astype(np.uint8)).convert("RGBA")
    ov = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(ov)
    sa = ease((p - 0.3) / 0.4)
    if sa > 0:
        for (sx, sy), b, ph in zip(stars, star_b, star_ph):
            v = int(255 * sa * b * (0.6 + 0.4 * math.sin(t * 2 + ph)))
            d.ellipse([sx - 1.6, sy - 1.6, sx + 1.6, sy + 1.6], fill=(255, 250, 230, v))
    if moon_a > 0:
        my = 420 - moon_a * 60
        for rr, al in ((140, 25), (100, 40)):
            d.ellipse([260 - rr, my - rr, 260 + rr, my + rr], fill=(240, 235, 210, int(al * moon_a)))
        moon = Image.new("RGBA", (200, 200))
        md = ImageDraw.Draw(moon)
        md.ellipse([40, 40, 160, 160], fill=(250, 245, 225, int(255 * moon_a)))
        md.ellipse([68, 28, 188, 148], fill=(0, 0, 0, 0))
        ov.alpha_composite(moon, (160, int(my - 100)))
    img.alpha_composite(ov)
    # dunes with parallax
    for im, sp in dunes:
        off = int(t * sp) % W
        img.alpha_composite(im.crop((off, 0, off + W, H)))
    # drifting sand dust
    ov = Image.new("RGBA", (W, H)); d = ImageDraw.Draw(ov)
    for k, (dx, dy) in enumerate(dust):
        x = (dx + t * (40 + k % 30)) % W
        y = (dy + 15 * math.sin(t + k)) % H
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 220, 170, 70))
    img.alpha_composite(ov)
    arr = np.array(img).astype(float)
    arr[..., :3] *= VIG
    # dark band behind text for legibility
    band = np.exp(-((np.arange(H) - 760) / 330.0) ** 2)[:, None, None] * 0.45
    arr[..., :3] *= (1 - band)
    frame = Image.fromarray(arr.clip(0, 255).astype(np.uint8))

    # ---- text timeline ----
    if t < INTRO + 0.5:
        a = ease(t / 1.2) * (1 - ease((t - INTRO + 0.6) / 0.8))
        paste(frame, title, W / 2, 700, a, dy=20 * (1 - ease(t / 1.5)))
        ornament(frame, 820, a, 260)
        paste(frame, sub, W / 2, 920, ease((t - 0.8) / 1.2) * (1 - ease((t - INTRO + 0.6) / 0.8)))
    elif t < INTRO + PER * len(BAYT):
        k = int((t - INTRO) / PER); lt = t - INTRO - k * PER
        out = 1 - ease((lt - PER + 0.9) / 0.8)
        a1 = ease(lt / 1.0) * out
        a2 = ease((lt - 1.8) / 1.0) * out
        paste(frame, num_imgs[k], W / 2, 500, ease(lt / 0.8) * out * 0.9)
        paste(frame, lines[k][0], W / 2, 650, a1, dy=25 * (1 - ease(lt / 1.2)))
        ornament(frame, 770, min(a1, 1) * out, 200)
        paste(frame, lines[k][1], W / 2, 890, a2, dy=25 * (1 - ease((lt - 1.8) / 1.2)))
    else:
        lt = t - INTRO - PER * len(BAYT)
        a = ease(lt / 1.2)
        paste(frame, title, W / 2, 720, a)
        ornament(frame, 840, a, 260)
    # global fade in/out
    g = ease(t / 1.0) * (1 - ease((t - DUR + 1.5) / 1.5))
    if g < 1:
        frame = Image.fromarray((np.array(frame).astype(float) * g).astype(np.uint8))
    return frame.convert("RGB")

# ---------- audio: drone + oud-like plucks (Bayati on D) + daf + wind ----------
SR = 44100
n = int(DUR * SR)
tt = np.arange(n) / SR
aud = np.zeros(n)
D = 146.83
for h, amp in ((0.5, .18), (1, .12), (1.5, .05), (2, .04)):
    aud += amp * np.sin(2 * math.pi * D * h * tt) * (0.8 + 0.2 * np.sin(2 * math.pi * 0.11 * tt * h))
# wind
wn = rng.normal(0, 1, n)
k = np.ones(400) / 400
wind = np.convolve(wn, k, "same") * (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * tt))
aud += wind * 0.8
def pluck(freq, dur=2.5):
    L = int(SR / freq); buf = rng.uniform(-1, 1, L); out = np.zeros(int(dur * SR))
    for i in range(len(out)):
        out[i] = buf[i % L]
        buf[i % L] = 0.996 * 0.5 * (buf[i % L] + buf[(i + 1) % L])
    return out
# Bayati: D E(half-flat) F G A Bb C D
scale = [D * r for r in (1, 1.0833, 1.1892, 1.3348, 1.4983, 1.5874, 1.7818, 2)]
cache = {}
mel = rng.integers(0, 8, 200)
beat = 60 / 72
tpos = 2.0; j = 0
while tpos < DUR - 3:
    f = scale[mel[j] % 8] * (2 if j % 7 == 3 else 1)
    if f not in cache: cache[f] = pluck(f)
    s = int(tpos * SR); seg = cache[f][: n - s]
    aud[s:s + len(seg)] += seg * 0.35
    tpos += beat * rng.choice([1, 1, 2, 1.5]); j += 1
# daf: "dum ... tak tak" pattern from intro onward
def drum(freq, decay, noise):
    d = np.arange(int(0.4 * SR)) / SR
    return (np.sin(2 * math.pi * freq * d * (1 + 0.5 * np.exp(-d * 30))) + noise * rng.normal(0, 1, len(d))) * np.exp(-d * decay)
dum, tak = drum(70, 9, 0.05), drum(220, 30, 0.6)
tb = INTRO
while tb < DUR - 4:
    for off, sm, g in ((0, dum, .5), (beat * 1.5, tak, .15), (beat * 2, tak, .2), (beat * 3, dum, .35)):
        s = int((tb + off) * SR)
        if s < n: seg = sm[: n - s]; aud[s:s + len(seg)] += seg * g
    tb += beat * 4
env = np.clip(tt / 2, 0, 1) * np.clip((DUR - tt) / 3, 0, 1)
aud *= env
aud = aud / np.abs(aud).max() * 0.8
import tempfile
wav = os.path.join(tempfile.gettempdir(), "poem_music.wav")
with wave.open(wav, "wb") as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((aud * 32767).astype(np.int16).tobytes())

# ---------- encode ----------
if "--still" in sys.argv:
    for sec in (2.5, 9, 30, 55, DUR - 2):
        render(int(sec * FPS)).save(f"{S}/still_{int(sec)}.png")
    sys.exit()
ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
                       "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "20",
                       "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT],
                      stdin=subprocess.PIPE)
for i in range(N):
    ff.stdin.write(render(i).tobytes())
    if i % 300 == 0: print(i, "/", N, flush=True)
ff.stdin.close(); ff.wait()
print("done", OUT)

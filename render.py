#!/usr/bin/env python3
"""Render frames / video from dist/morph.html with Playwright + ffmpeg."""
import io, os, sys, subprocess
from playwright.sync_api import sync_playwright
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
URL = 'file://' + os.path.join(ROOT, 'dist', 'morph.html')
OUT = os.path.join(ROOT, 'dist')
TMP = os.path.join(ROOT, 'frames')
BEAT = 0.5
FPS = 60
SUB = 4
DUR = 20.0

FREEZE = """
document.body.classList.add('static');
var bx = document.getElementById('box');
bx.style.width = '1440px';
bx.style.height = '1440px';
bx.style.margin = '0';
var w = document.getElementById('wrap');
w.style.transform = 'scale(1)';
w.style.transformOrigin = 'top left';
window.__stop();
"""


def open_page(p):
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 1440}, device_scale_factor=1)
    pg.goto(URL)
    pg.wait_for_function('window.MORPH_READY === true', timeout=60000)
    pg.evaluate(FREEZE)
    return b, pg


def grab(pg, t):
    pg.evaluate('window.__seek(%r)' % float(t))
    return Image.open(io.BytesIO(pg.locator('#stage').screenshot())).convert('RGB')


def sheet():
    os.makedirs(TMP, exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p)
        ims = []
        for b_i in range(40):
            t = b_i * BEAT + 0.25
            ims.append(grab(pg, t))
            print('beat', b_i, flush=True)
        b.close()
    cell = 240
    cols, rows = 8, 5
    sheet_img = Image.new('RGB', (cols * cell, rows * cell), (255, 255, 255))
    d = ImageDraw.Draw(sheet_img)
    try:
        f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
    except Exception:
        f = ImageFont.load_default()
    for i, im in enumerate(ims):
        x = (i % cols) * cell
        y = (i // cols) * cell
        sheet_img.paste(im.resize((cell, cell), Image.LANCZOS), (x, y))
        d.rectangle([x, y, x + 46, y + 24], fill=(10, 10, 10))
        d.text((x + 6, y + 3), 'b%d' % i, fill=(255, 255, 255), font=f)
    out = os.path.join(TMP, 'sheet.png')
    sheet_img.save(out)
    print('sheet ->', out)


def one(t):
    os.makedirs(TMP, exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p)
        im = grab(pg, t)
        b.close()
    out = os.path.join(TMP, 't_%s.png' % str(t).replace('.', '_'))
    im.save(out)
    print('frame ->', out)


def video():
    os.makedirs(TMP, exist_ok=True)
    nframes = int(round(DUR * FPS))
    cmd = ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1440x1440',
           '-framerate', str(FPS * SUB), '-i', '-',
           '-vf', "tmix=frames=%d,select='not(mod(n+1,%d))',setpts=N/%d/TB" % (SUB, SUB, FPS),
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
           '-r', str(FPS), '-movflags', '+faststart', os.path.join(OUT, 'morph.mp4')]
    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    with sync_playwright() as p:
        b, pg = open_page(p)
        for i in range(nframes):
            for k in range(SUB):
                t = (i + k / SUB) / FPS
                im = grab(pg, t)
                proc.stdin.write(im.tobytes())
            if i % 60 == 0:
                print('frame', i, '/', nframes, flush=True)
        b.close()
    proc.stdin.close()
    err = proc.stderr.read().decode()
    rc = proc.wait()
    print('ffmpeg rc', rc)
    if rc != 0:
        print(err[-3000:])


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sheet'
    if mode == 'sheet':
        sheet()
    elif mode == 'one':
        one(float(sys.argv[2]))
    elif mode == 'video':
        video()

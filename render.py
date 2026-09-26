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


COMPONENT_URL = 'file://' + os.path.join(ROOT, 'dist', 'component.html')

CATALOG_BEATS = [
    ('button', 0, 4), ('loader', 4, 8), ('check', 8, 12), ('player', 12, 16),
    ('progress', 16, 20), ('slider', 20, 24), ('toggle', 24, 28), ('tabs', 28, 32),
    ('chart', 32, 35.5), ('palette', 35.5, 38), ('notify', 38, 38.75),
]

COMPONENTS = [
    ('button',   'Button',          '按下 → 释放，弹簧回弹带轻微超调'),
    ('loader',   'Loader',          '收成圆，弧扫三圈后闭合成环'),
    ('check',    'Checkmark',       '笔画自绘；强调色第一次出现'),
    ('player',   'Music player',    '展开成卡片，播放与暂停反向旋转交替'),
    ('progress', 'Progress',        '抓住播放头拖动，松手从当前位置弹回'),
    ('slider',   'Volume slider',   '拖过最大值：元素拉伸 6%，旋钮压扁'),
    ('toggle',   'Switch',          '旋钮前后缘各骑一个弹簧，翻转中途被拉长'),
    ('tabs',     'Liquid tabs',     '指示器前缘先到，拖着后缘走'),
    ('chart',    'Chart',           '折线自绘 1.25 拍，悬停升起 tooltip'),
    ('palette',  'Command palette', '三次输入实时过滤，回车选中首行'),
    ('notify',   'Notification',    '一闪而过的 toast，随即变回按钮闭合循环'),
]


def open_page(p, url=URL, freeze=True):
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1440, 'height': 1440}, device_scale_factor=1)
    pg.goto(url)
    pg.wait_for_function('window.MORPH_READY === true', timeout=60000)
    if freeze:
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


def components():
    os.makedirs(os.path.join(ROOT, 'media'), exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p, COMPONENT_URL, freeze=False)
        for key, name, desc in COMPONENTS:
            cat = next(c for c in CATALOG_BEATS if c[0] == key)
            s0, s1 = cat[1] + 0.50, cat[2] - 0.05
            span = (s1 - s0) * BEAT
            half = max(1.2, span)
            total = 2 * half
            nframes = int(round(total * FPS))
            out = os.path.join(ROOT, 'media', key + '.mp4')
            cmd = ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1440x1440',
                   '-framerate', str(FPS * SUB), '-i', '-',
                   '-vf', "tmix=frames=%d,select='not(mod(n+1,%d))',setpts=N/%d/TB" % (SUB, SUB, FPS),
                   '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                   '-r', str(FPS), '-movflags', '+faststart', out]
            proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            label = '%s · %s' % (name, {'button': '按钮', 'loader': '加载器', 'check': '勾选',
                                        'player': '播放器', 'progress': '进度条', 'slider': '音量滑块',
                                        'toggle': '开关', 'tabs': '液体标签', 'chart': '图表',
                                        'palette': '命令面板', 'notify': '通知'}[key])
            pg.evaluate('window.__setLabel(%r, %r)' % (label, desc))
            for i in range(nframes):
                for k in range(SUB):
                    tt = (i + k / SUB) / FPS
                    u = tt / total
                    ptri = 2 * u if u < 0.5 else 2 * (1 - u)
                    t = (s0 + (s1 - s0) * ptri) * BEAT
                    pg.evaluate('window.__seek(%r)' % float(t))
                    im = Image.open(io.BytesIO(pg.locator('#stage').screenshot())).convert('RGB')
                    proc.stdin.write(im.tobytes())
            proc.stdin.close()
            err = proc.stderr.read().decode()
            rc = proc.wait()
            print(key, 'rc', rc, os.path.getsize(out) // 1024, 'KB', flush=True)
            if rc != 0:
                print(err[-1500:])
        b.close()


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sheet'
    if mode == 'sheet':
        sheet()
    elif mode == 'one':
        one(float(sys.argv[2]))
    elif mode == 'video':
        video()
    elif mode == 'components':
        components()

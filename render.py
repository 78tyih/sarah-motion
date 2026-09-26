#!/usr/bin/env python3
"""Sarah — render frames / videos from dist/*.html with Playwright + ffmpeg.

modes
  sheet [basic|quote]   one frame per beat -> frames/sheet_<engine>.png
  one <t> [quote]       single frame
  video [basic|quote]   20s showreel, 60fps, 4 subframes + tmix -> dist/morph.mp4 | dist/quote.mp4
  components <engine>   one looping mp4 per component -> media/
  loop <engine>         loop-closure check (frame 0 vs frame T)
"""
import io, os, sys, subprocess
from playwright.sync_api import sync_playwright
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, 'dist')
TMP = os.path.join(ROOT, 'frames')
MEDIA = os.path.join(ROOT, 'media')
BEAT = 0.5
FPS = 60
SUB = 4
DUR = 20.0

PAGE_BASIC = 'file://' + os.path.join(ROOT, 'dist', 'morph.html')
PAGE_COMPONENT = 'file://' + os.path.join(ROOT, 'dist', 'component.html')

FREEZE = """
document.body.classList.add('static');
var bx = document.getElementById('box');
bx.style.width = '1440px'; bx.style.height = '1440px'; bx.style.margin = '0';
var w = document.getElementById('wrap');
w.style.transform = 'scale(1)'; w.style.transformOrigin = 'top left';
window.__stop();
"""

# key, English name, Chinese name, one-line Chinese description, [b0, b1]
CATALOG = {
    'basic': [
        ('button',   'Button',          '按钮',        '按下 → 释放，弹簧回弹带轻微超调', [0, 4]),
        ('loader',   'Loader',          '加载器',      '收成圆，弧扫三圈后闭合成环', [4, 8]),
        ('check',    'Checkmark',       '勾选',        '笔画自绘；强调色第一次出现', [8, 12]),
        ('player',   'Music player',    '播放器',      '展开成卡片，播放与暂停反向旋转交替', [12, 16]),
        ('progress', 'Progress',        '进度条',      '抓住播放头拖动，松手从当前位置弹回', [16, 20]),
        ('slider',   'Volume slider',   '音量滑块',    '拖过最大值：元素拉伸，旋钮压扁', [20, 24]),
        ('toggle',   'Switch',          '开关',        '旋钮前后缘各骑一个弹簧，翻转中途被拉长', [24, 28]),
        ('tabs',     'Liquid tabs',     '液体标签',    '指示器前缘先到，拖着后缘走', [28, 32]),
        ('chart',    'Chart',           '图表',        '折线自绘 1.25 拍，悬停升起 tooltip', [32, 35.5]),
        ('palette',  'Command ⌘K',      '命令面板',    '三次输入实时过滤，回车选中首行', [35.5, 38]),
        ('notify',   'Notification',    '通知',        '一闪而过的 toast，随即变回按钮闭合循环', [38, 38.75]),
    ],
    'quote': [
        ('quote',     'Price tag',        '价格标签',     '报价 pill：代码 + 价格 + 涨跌幅，按下回弹', [0, 4]),
        ('feed',      'Tick feed',        'tick 接入',    '收成圆，弧扫三圈——行情流接入', [4, 8]),
        ('fill',      'Fill confirm',     '成交确认',     '笔画自绘，订单成交', [8, 12]),
        ('replay',    'Session replay',   '分时回放',     '展开成卡片，绿色分时线自绘，播放与暂停交替', [12, 16]),
        ('timeline',  'Scrub timeline',   '时间轴拖拽',   '抓住播放头拖动，松手从当前位置弹回', [16, 20]),
        ('leverage',  'Leverage',         '杠杆滑块',     '拖过上限：整体拉伸、转风险红、相机后退', [20, 24]),
        ('mode',      'Paper / Live',     '模拟 / 实盘',  '旋钮前后缘各骑一个弹簧，翻转中途被拉长', [24, 28]),
        ('timeframe', 'Timeframe',        '周期切换',     '1m / 5m / 1h / 1D，指示器前缘先到拖着后缘', [28, 32]),
        ('equity',    'Equity curve',     '净值曲线',     '绿线自绘 + 回撤区浮现 + 悬停显示 −4.8%', [32, 35.5]),
        ('search',    'Symbol ⌘K',        '代码搜索',     '输入 n → nv → nvd，列表实时收敛，回车选中', [35.5, 38]),
        ('notify',    'Watchlist toast',  '加自选通知',   '一闪而过，随即变回价格标签闭合循环', [38, 38.75]),
    ],
}


def page_url(engine, role='component'):
    if role == 'showreel':
        return PAGE_BASIC if engine == 'basic' else PAGE_COMPONENT + '?engine=quote'
    return PAGE_COMPONENT + ('?engine=' + engine if engine != 'basic' else '')


def open_page(p, url, freeze=False):
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


def ffmpeg_pipe(out, framerate):
    return subprocess.Popen(
        ['ffmpeg', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1440x1440',
         '-framerate', str(framerate), '-i', '-',
         '-vf', "tmix=frames=%d,select='not(mod(n+1,%d))',setpts=N/%d/TB" % (SUB, SUB, FPS),
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p',
         '-r', str(FPS), '-movflags', '+faststart', out],
        stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)


def shot(pg, t, proc):
    im = grab(pg, t)
    proc.stdin.write(im.tobytes())


# ---------------------------------------------------------------- showreel
def video(engine='basic'):
    url = page_url(engine, 'showreel')
    out = os.path.join(OUT, 'morph.mp4' if engine == 'basic' else 'quote.mp4')
    nframes = int(round(DUR * FPS))
    proc = ffmpeg_pipe(out, FPS * SUB)
    with sync_playwright() as p:
        b, pg = open_page(p, url, freeze=(engine == 'basic'))
        for i in range(nframes):
            for k in range(SUB):
                shot(pg, (i + k / SUB) / FPS, proc)
            if i % 120 == 0:
                print('  %s frame %d/%d' % (engine, i, nframes), flush=True)
        b.close()
    proc.stdin.close()
    err = proc.stderr.read().decode()
    rc = proc.wait()
    print('%-6s showreel rc=%d %.1f MB' % (engine, rc, os.path.getsize(out) / 1e6))
    if rc != 0:
        print(err[-1500:])


# -------------------------------------------------------------- components
def components(engine='basic'):
    """Each component loops as: forward over the state window, then back. Seamless."""
    os.makedirs(MEDIA, exist_ok=True)
    url = page_url(engine)
    prefix = '' if engine == 'basic' else 'quote-'
    with sync_playwright() as p:
        b, pg = open_page(p, url)
        for key, name, cn, desc, (b0, b1) in CATALOG[engine]:
            s0, s1 = b0 + 0.50, b1 - 0.05
            half = max(1.2, (s1 - s0) * BEAT)
            total = 2 * half
            nframes = int(round(total * FPS))
            out = os.path.join(MEDIA, prefix + key + '.mp4')
            proc = ffmpeg_pipe(out, FPS * SUB)
            pg.evaluate('window.__setLabel(%r, %r)' % (name + ' · ' + cn, desc))
            for i in range(nframes):
                for k in range(SUB):
                    u = ((i + k / SUB) / FPS) / total
                    tri = 2 * u if u < 0.5 else 2 * (1 - u)
                    shot(pg, (s0 + (s1 - s0) * tri) * BEAT, proc)
            proc.stdin.close()
            err = proc.stderr.read().decode()
            rc = proc.wait()
            print('  %-18s rc=%d %4d KB' % (prefix + key, rc, os.path.getsize(out) // 1024), flush=True)
            if rc != 0:
                print(err[-1200:])
        b.close()


# ------------------------------------------------------------------- sheet
def sheet(engine='basic'):
    os.makedirs(TMP, exist_ok=True)
    url = page_url(engine, 'showreel')
    with sync_playwright() as p:
        b, pg = open_page(p, url, freeze=(engine == 'basic'))
        ims = []
        for b_i in range(40):
            ims.append(grab(pg, b_i * BEAT + 0.25))
        b.close()
    cell, cols, rows = 240, 8, 5
    out_img = Image.new('RGB', (cols * cell, rows * cell), (255, 255, 255))
    d = ImageDraw.Draw(out_img)
    try:
        f = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 18)
    except Exception:
        f = ImageFont.load_default()
    for i, im in enumerate(ims):
        x, y = (i % cols) * cell, (i // cols) * cell
        out_img.paste(im.resize((cell, cell), Image.LANCZOS), (x, y))
        d.rectangle([x, y, x + 46, y + 24], fill=(10, 10, 10))
        d.text((x + 6, y + 3), 'b%d' % i, fill=(255, 255, 255), font=f)
    out = os.path.join(TMP, 'sheet_%s.png' % engine)
    out_img.save(out)
    print('sheet ->', out)


def one(t, engine='basic'):
    os.makedirs(TMP, exist_ok=True)
    with sync_playwright() as p:
        b, pg = open_page(p, page_url(engine, 'showreel'), freeze=(engine == 'basic'))
        im = grab(pg, t)
        b.close()
    out = os.path.join(TMP, 't_%s_%s.png' % (engine, str(t).replace('.', '_')))
    im.save(out)
    print('frame ->', out)


def loop_check(engine='basic'):
    with sync_playwright() as p:
        b, pg = open_page(p, page_url(engine, 'showreel'), freeze=(engine == 'basic'))
        a, z = grab(pg, 0.0), grab(pg, DUR)
        b.close()
    d = ImageChops.difference(a, z)
    h = d.histogram()
    big = sum(sum(h[c * 256 + v] for v in range(20, 256)) for c in range(3))
    print('%-6s loop closure: max=%s pixels>20=%d (%.4f%%)'
          % (engine, [x[1] for x in d.getextrema()], big, 100 * big / (1440 * 1440 * 3)))


if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'sheet'
    engine = sys.argv[2] if len(sys.argv) > 2 else 'basic'
    if mode == 'sheet':
        sheet(engine)
    elif mode == 'one':
        one(float(sys.argv[2]), sys.argv[3] if len(sys.argv) > 3 else 'basic')
    elif mode == 'video':
        video(engine)
    elif mode == 'components':
        components(engine)
    elif mode == 'loop':
        loop_check(engine)

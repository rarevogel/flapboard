#!/usr/bin/env python3
"""Builds one self-contained flapboard.html and copies it into the Android app.
The fonts are cut down to exactly the characters the boards use (fontTools), so ten writing systems fit in a small file."""
import base64, glob, io, os, shutil
from fontTools import subset
from fontTools.ttLib import TTFont

here = os.path.dirname(os.path.abspath(__file__))
web = os.path.join(here, 'web')
fs = os.path.join(here, 'node_modules', '@fontsource')
JS = ['data.js', 'app.js']

text = ''.join(open(os.path.join(web, f), encoding='utf-8').read() for f in JS + ['index.html'])
chars = set(text) | set(chr(c) for c in range(32, 127))
# lower/upper case forms of every letter, since the board can switch capitals on and off
chars |= {u for c in list(chars) for u in (c.upper(), c.lower()) if len(u) == 1}
chars |= set('ÀÁÂÄÇÈÉÊËÍÎÏÑÓÔÖÚÛÜ')

FONTS = {   # family: glob of fontsource woff2 files (bold)
    'FlapLatin': 'fira-sans-condensed/files/fira-sans-condensed-*-700-normal.woff2',
    'FlapHe': 'noto-sans-hebrew/files/noto-sans-hebrew-hebrew-700-normal.woff2',
    'FlapAr': 'noto-sans-arabic/files/noto-sans-arabic-arabic-700-normal.woff2',
    'FlapDeva': 'noto-sans-devanagari/files/noto-sans-devanagari-devanagari-700-normal.woff2',
    'FlapThai': 'noto-sans-thai/files/noto-sans-thai-thai-700-normal.woff2',
    'FlapJP': 'noto-sans-jp/files/noto-sans-jp-[0-9]*-700-normal.woff2',
    'FlapSC': 'noto-sans-sc/files/noto-sans-sc-[0-9]*-700-normal.woff2',
    'FlapKR': 'noto-sans-kr/files/noto-sans-kr-[0-9]*-700-normal.woff2',
}

def ranges(cps):
    cps = sorted(cps); out = []; i = 0
    while i < len(cps):
        j = i
        while j + 1 < len(cps) and cps[j + 1] == cps[j] + 1: j += 1
        out.append(f'U+{cps[i]:X}' if i == j else f'U+{cps[i]:X}-{cps[j]:X}'); i = j + 1
    return ','.join(out)

faces = []; total = 0
for fam, pat in FONTS.items():
    for path in sorted(glob.glob(os.path.join(fs, pat))):
        cmap = TTFont(path).getBestCmap()
        want = {ord(c) for c in chars} & set(cmap)
        if fam != 'FlapLatin': want = {c for c in want if c >= 0x370}   # Latin comes from FlapLatin
        if not want: continue
        opts = subset.Options(); opts.flavor = 'woff2'; opts.layout_features = ['*']; opts.name_IDs = []; opts.notdef_outline = True
        f = TTFont(path); s = subset.Subsetter(opts); s.populate(unicodes=want); s.subset(f)
        buf = io.BytesIO(); f.flavor = 'woff2'; f.save(buf); data = buf.getvalue(); total += len(data)
        faces.append(f"@font-face{{font-family:'{fam}';font-weight:700;font-display:block;unicode-range:{ranges(want)};src:url(data:font/woff2;base64,{base64.b64encode(data).decode()}) format('woff2')}}")
print(f'fonts: {len(faces)} faces, {total // 1024} KB')

html = open(os.path.join(web, 'index.html'), encoding='utf-8').read()
code = '\n'.join(open(os.path.join(web, f), encoding='utf-8').read() for f in JS)
html = html.replace('/*@FONTS*/', '\n'.join(faces)).replace('/*@SCRIPT*/', code.replace('</script', '<\\/script'))
os.makedirs(os.path.join(here, 'dist'), exist_ok=True)
out = os.path.join(here, 'dist', 'flapboard.html')
open(out, 'w', encoding='utf-8').write(html)
assets = os.path.join(here, 'android', 'assets'); os.makedirs(assets, exist_ok=True)
shutil.copy(out, os.path.join(assets, 'index.html'))
print(out, os.path.getsize(out))

"""Render the coaching report (HTML + single-page phone PDF + preview images).

usage:
  python build.py --work-dir work/ --out-html out.html --out-pdf out.pdf \
      [--detail output/data/inbody_detail_<date>.json] [--preview-dir work/preview] [--chrome PATH]

--work-dir must contain chart_data.json and stats.json (from analyze.py) and
content.json (the written feedback, see references/content-schema.md).
"""
import argparse
import glob
import json
import math
import os
import shutil
import subprocess
import sys

import jinja2

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, '..', 'assets')
FIT = "st.textContent=`@page{size:${w}px ${h}px;margin:0}`;"
PDF_WIDTH = 500  # headless Chrome's minimum window width; reads well on phones
REQUIRED = ['hero.h1', 'hero.lead', 'overall.grade', 'overall.summary', 'grades', 'kpis', 'protein.h2', 'protein.lead',
            'daily.h2', 'daily.lead', 'balance.h2', 'balance.lead', 'consistency.h2', 'consistency.lead', 'patterns.h2',
            'patterns.lead', 'training.h2', 'training.lead', 'training.week', 'targets.h2', 'targets.rows',
            'targets.checklist']


def find_chrome(explicit):
    cands = [explicit] if explicit else []
    cands += [r'C:\Program Files\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Google\Chrome\Application\chrome.exe',
              r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
              '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/opt/pw-browsers/chromium']
    cands += [shutil.which(n) for n in ['google-chrome', 'chromium', 'chromium-browser', 'chrome', 'msedge']]
    cands += sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
    for c in cands:
        if c and os.path.exists(c):
            return c
    sys.exit('Chrome/Chromium/Edge not found; pass --chrome PATH')


def url_of(path):
    p = os.path.abspath(path).replace('\\', '/')
    return 'file:///' + p.lstrip('/')


def check_content(c):
    missing = []
    for key in REQUIRED:
        cur = c
        for part in key.split('.'):
            cur = cur.get(part) if isinstance(cur, dict) else None
        if not cur:
            missing.append(key)
    if missing:
        sys.exit('content.json is missing: ' + ', '.join(missing))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--work-dir', required=True)
    ap.add_argument('--out-html', required=True)
    ap.add_argument('--out-pdf', required=True)
    ap.add_argument('--detail', help='InBody result-sheet detail JSON (optional)')
    ap.add_argument('--preview-dir')
    ap.add_argument('--chrome')
    a = ap.parse_args()

    load = lambda n: json.load(open(os.path.join(a.work_dir, n), encoding='utf-8'))
    chart, stats, content = load('chart_data.json'), load('stats.json'), load('content.json')
    check_content(content)
    detail = json.load(open(a.detail, encoding='utf-8')) if a.detail else None

    env = jinja2.Environment(loader=jinja2.FileSystemLoader(ASSETS), autoescape=False,
                             undefined=jinja2.ChainableUndefined)
    page = env.get_template('template.html').render(
        c=content, stats=stats, chart=chart, detail=detail,
        chart_json=json.dumps(chart, ensure_ascii=False, separators=(',', ':')),
        detail_json=json.dumps(detail, ensure_ascii=False) if detail else 'null')
    for p in [a.out_html, a.out_pdf]:
        os.makedirs(os.path.dirname(os.path.abspath(p)), exist_ok=True)
    open(a.out_html, 'w', encoding='utf-8').write(page)
    print('html', a.out_html)

    chrome = find_chrome(a.chrome)
    tmp = os.path.join(os.path.dirname(os.path.abspath(a.out_html)), '_pdf_tmp.html')

    def export(height):
        open(tmp, 'w', encoding='utf-8').write(page.replace(FIT, f"st.textContent='@page{{size:{PDF_WIDTH}px {height}px;margin:0}}';"))
        subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', f'--window-size={PDF_WIDTH},900',
                        '--no-pdf-header-footer', '--virtual-time-budget=8000', '--print-to-pdf=' + os.path.abspath(a.out_pdf),
                        url_of(tmp) + '#pdf'], capture_output=True)

    import fitz  # PyMuPDF
    try:
        # pass 1 on a very tall page to find where the content ends; pass 2 at that height.
        # (Chrome's print layout can be a few hundred px taller than the screen layout, so
        # the page height is measured from the printed result, then grown if anything spills.)
        export(19000)
        d = fitz.open(a.out_pdf)
        bottom = max(b[3] for b in d[0].get_text('blocks'))
        d.close()
        height = math.ceil(bottom * 4 / 3) + 44
        for _ in range(5):
            export(height)
            d = fitz.open(a.out_pdf)
            if d.page_count == 1:
                break
            blocks = d[1].get_text('blocks')
            height += math.ceil((max(b[3] for b in blocks) if blocks else 20) * 4 / 3) + 10
            d.close()
        pages = d.page_count
        print(f'pdf {a.out_pdf} pages={pages} size={PDF_WIDTH}x{height}px')
        if a.preview_dir:
            os.makedirs(a.preview_dir, exist_ok=True)
            from PIL import Image
            full = os.path.join(a.preview_dir, 'pdf_full.png')
            d[0].get_pixmap(dpi=72).save(full)
            im = Image.open(full)
            chunks = []
            for i, y in enumerate(range(0, im.height, 2400)):
                p = os.path.join(a.preview_dir, f'pdf_{i}.png')
                im.crop((0, y, im.width, min(y + 2400, im.height))).save(p)
                chunks.append(Image.open(p))
            sheet = Image.new('RGB', (sum(c.width + 10 for c in chunks), 2400), 'white')
            x = 0
            for c in chunks:
                sheet.paste(c, (x, 0)); x += c.width + 10
            sheet.save(os.path.join(a.preview_dir, 'pdf_overview.png'))
            subprocess.run([chrome, '--headless=new', '--disable-gpu', '--hide-scrollbars', '--window-size=1280,3200',
                            '--virtual-time-budget=8000', '--screenshot=' + os.path.abspath(os.path.join(a.preview_dir, 'desktop_top.png')),
                            url_of(a.out_html)], capture_output=True)
            print('preview', os.path.join(a.preview_dir, 'pdf_overview.png'), '+ desktop_top.png')
        d.close()
        if pages != 1:
            print('WARNING: PDF still has', pages, 'pages')
    finally:
        if os.path.exists(tmp):
            os.remove(tmp)


if __name__ == '__main__':
    main()

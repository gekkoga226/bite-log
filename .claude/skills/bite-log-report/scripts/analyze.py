"""Aggregate Bite-Log meals + InBody data for a period.

usage:
  python analyze.py --xlsx bitelog.xlsx --start 2026-01-01 --end 2026-06-30 \
      --out-dir work/ [--inbody-history output/data/inbody_history.csv]

Writes to --out-dir:
  chart_data.json  data the report template draws from (embedded in the page)
  stats.json       every number the written feedback should cite
  stats.md         the same, condensed, for reading before writing content.json

"Full days" = days where 朝食, 昼食 and 夕食 are all recorded; nutrition averages use
full days only, because a day missing a meal would drag every average down.
"""
import argparse
import collections
import csv
import datetime as dt
import json
import os
import re
import statistics as st

import openpyxl

MEAL_TYPES = ['朝食', '昼食', '夕食', '間食']
CORE = {'朝食', '昼食', '夕食'}
WD = ['月', '火', '水', '木', '金', '土', '日']  # Python weekday(): Monday=0
HEADER_ALIASES = {
    'ts': ['timestamp', 'タイムスタンプ'],
    'date': ['date', '日付'],
    'type': ['mealtype', '食事タイプ'],
    'memo': ['memo', '食事の内容メモ'],
    'note': ['note', '備考・補足'],
    'cal': ['calories', 'カロリー'],
    'p': ['protein', 'タンパク質', 'たんぱく質'],
    'f': ['fat', '脂質'],
    'c': ['carbs', '炭水化物'],
    'comment': ['comment', 'aiコメント'],
}
DEFAULT_GOALS = {'k': 1800, 'p': 93, 'f': 42, 'c': 195}
NOODLE = ['ラーメン', 'うどん', 'そば', 'パスタ', '麺', 'スパゲッティ', 'ちゃんぽん']
FRIED = ['揚げ', '唐揚', 'フライ', '天ぷら', 'カツ', 'ポテト', '南蛮', 'コロッケ']


# ---------- parsing ----------
def to_date(v):
    if v is None or v == '':
        return None
    if isinstance(v, dt.datetime):
        return v.date()
    if isinstance(v, dt.date):
        return v
    s = str(v).strip()
    m = re.match(r'(\d{4})[/-](\d{1,2})[/-](\d{1,2})', s)
    return dt.date(int(m[1]), int(m[2]), int(m[3])) if m else None


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def header_map(row):
    norm = [str(h).strip().lower() if h is not None else '' for h in row]
    out = {}
    for key, names in HEADER_ALIASES.items():
        for i, h in enumerate(norm):
            if h in [n.lower() for n in names]:
                out[key] = i
                break
    return out


def items_of(text):
    """Dish names from the AI comment ('白米, 鮭, 味噌汁 : comment...')."""
    seg = re.split(r'\s*[:：]\s*', text.strip(), maxsplit=1)[0]
    out = []
    for p in re.split(r'[,、，]', seg):
        p = re.sub(r'（.*?）|\(.*?\)', '', p).strip()
        for q in p.split('  '):  # memo and dish name can arrive joined by two spaces
            q = q.strip()
            if q and q not in out and q != 'エラー' and len(q) <= 30:
                out.append(q)
    return out


def load_meals(wb):
    recs, seen = [], {}
    for ws in wb.worksheets:
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            continue
        hm = header_map(rows[0])
        if not {'date', 'type', 'cal', 'p', 'f', 'c'} <= hm.keys():
            continue
        for r in rows[1:]:
            g = lambda k: r[hm[k]] if k in hm and hm[k] < len(r) else None
            d = to_date(g('date'))
            ty = (g('type') or '').strip() if isinstance(g('type'), str) else g('type')
            if not d or ty not in MEAL_TYPES:
                continue
            rec = dict(date=d.isoformat(), type=ty, cal=num(g('cal')), p=num(g('p')), f=num(g('f')), c=num(g('c')),
                       memo=str(g('memo') or ''), note=str(g('note') or ''), comment=str(g('comment') or ''),
                       sheet=ws.title)
            # the old form sheet and the app sheet may overlap; drop a row only when the
            # same meal already came from a *different* sheet (same-sheet repeats are real)
            key = (rec['date'], ty, round(rec['cal']), round(rec['p']))
            if any(s != ws.title for s in seen.get(key, ())):
                continue
            seen.setdefault(key, set()).add(ws.title)
            text = ' '.join(x for x in [rec['memo'], rec['note'], rec['comment']] if x.strip())
            rec['items'] = items_of(rec['comment']) or items_of(rec['memo'] or rec['note'] or '')
            rec['text'] = text
            recs.append(rec)
    return recs


def load_goals(wb):
    names = wb.sheetnames
    if 'settings' in names:
        rows = list(wb['settings'].iter_rows(values_only=True))
        if len(rows) >= 2:
            hm = {str(h).strip().lower(): i for i, h in enumerate(rows[0]) if h}
            try:
                return {'k': num(rows[1][hm['calories']]), 'p': num(rows[1][hm['protein']]),
                        'f': num(rows[1][hm['fat']]), 'c': num(rows[1][hm['carbs']]), 'source': 'settings'}
            except KeyError:
                pass
    if '目標値' in names:
        vals = {str(r[0]).strip(): num(r[1]) for r in wb['目標値'].iter_rows(min_row=2, values_only=True) if r[0]}
        if vals:
            return {'k': vals.get('カロリー', DEFAULT_GOALS['k']), 'p': vals.get('タンパク質', DEFAULT_GOALS['p']),
                    'f': vals.get('脂質', DEFAULT_GOALS['f']), 'c': vals.get('炭水化物', DEFAULT_GOALS['c']), 'source': '目標値'}
    return dict(DEFAULT_GOALS, source='default')


def load_inbody(wb, history_csv):
    """Sheet rows + optional history CSV (from InBody result-sheet photos).

    The app stores the day a result was *registered*, which can be a day or two after
    the measurement. When a history row has the same weight/fat%/muscle within 7 days,
    the history date wins and the sheet's extra fields (fat mass, BMR) are kept.
    """
    sheet = []
    if 'inbody' in wb.sheetnames:
        rows = list(wb['inbody'].iter_rows(values_only=True))
        hm = {str(h).strip(): i for i, h in enumerate(rows[0]) if h} if rows else {}
        for r in rows[1:]:
            d = to_date(r[hm['date']]) if 'date' in hm else None
            if not d:
                continue
            sheet.append(dict(date=d, w=num(r[hm['weight']]), fp=num(r[hm['bodyFatPercent']]), mm=num(r[hm['muscleMass']]),
                              fm=num(r[hm['bodyFatMass']]) if 'bodyFatMass' in hm else None,
                              bmr=num(r[hm['basalMetabolism']]) if 'basalMetabolism' in hm else None, src='sheet'))
    hist = []
    if history_csv and os.path.exists(history_csv):
        for r in csv.DictReader(open(history_csv, encoding='utf-8-sig')):
            d = to_date(r.get('date'))
            if not d:
                continue
            f = lambda k: float(r[k]) if r.get(k) not in (None, '', 'None') else None
            hist.append(dict(date=d, w=f('weight_kg'), fp=f('body_fat_pct'), mm=f('muscle_mass_kg'),
                             fm=f('body_fat_mass_kg'), bmr=f('bmr_kcal'), src='history'))
    merged, used = [], set()
    for h in hist:
        for i, s in enumerate(sheet):
            if i in used:
                continue
            if abs((s['date'] - h['date']).days) <= 14 and s['w'] == h['w'] and s['fp'] == h['fp'] and s['mm'] == h['mm']:
                used.add(i)
                h = dict(h, fm=h['fm'] or s['fm'], bmr=h['bmr'] or s['bmr'], src='history+sheet',
                         sheet_date=s['date'].isoformat() if s['date'] != h['date'] else None)
                break
        merged.append(h)
    merged += [s for i, s in enumerate(sheet) if i not in used]
    by_date = {}
    for m in merged:  # one measurement per date; prefer the history-backed row
        if m['date'] not in by_date or m['src'] != 'sheet':
            by_date[m['date']] = m
    out = sorted(by_date.values(), key=lambda m: m['date'])
    for m in out:
        if m['fm'] is None and m['w'] and m['fp']:
            m['fm'] = round(m['w'] * m['fp'] / 100, 1)
    return out


def _num_or_none(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def export_rows_to_measurements(rows):
    """InBody app export rows (dicts keyed by the CSV's Japanese headers) -> measurements.

    This is the most reliable source: exact measurement time and both 筋肉量 (muscle mass,
    what the report charts) and 骨格筋量 (skeletal muscle mass).
    """
    def col(r, name):
        for k, v in r.items():
            if k and re.sub(r'\(.*\)$', '', str(k)).strip() == name:
                return _num_or_none(v)
        return None
    out = []
    for r in rows:
        stamp = str(r.get('日付') or '').strip()
        m = re.match(r'^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})', stamp)
        if not m:
            continue
        out.append(dict(date=dt.date(int(m[1]), int(m[2]), int(m[3])), time=f'{m[4]}:{m[5]}',
                        w=col(r, '体重'), fp=col(r, '体脂肪率'), mm=col(r, '筋肉量'), fm=col(r, '体脂肪量'),
                        bmr=col(r, '基礎代謝量'), smm=col(r, '骨格筋量'), score=col(r, 'InBody点数'),
                        visceral=col(r, '内臓脂肪レベル'), waist=col(r, '腹囲'), src='export'))
    by_date = {}
    for m in sorted(out, key=lambda x: (x['date'], x['time'])):
        by_date[m['date']] = m  # several measurements on one day -> keep the last
    return [by_date[d] for d in sorted(by_date)]


def load_inbody_export(wb, csv_path):
    rows = []
    if csv_path and os.path.exists(csv_path):
        rows += list(csv.DictReader(open(csv_path, encoding='utf-8-sig')))
    if 'inbody_full' in wb.sheetnames:
        sheet_rows = list(wb['inbody_full'].iter_rows(values_only=True))
        if sheet_rows:
            hdr = [str(h).strip() if h is not None else '' for h in sheet_rows[0]]
            rows += [dict(zip(hdr, ['' if v is None else str(v) for v in r])) for r in sheet_rows[1:]]
    return export_rows_to_measurements(rows)


# ---------- stats ----------
def r1(x):
    return round(x, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--xlsx', required=True)
    ap.add_argument('--start', required=True)
    ap.add_argument('--end', required=True)
    ap.add_argument('--out-dir', required=True)
    ap.add_argument('--inbody-history', help='CSV transcribed from result-sheet photos (fallback)')
    ap.add_argument('--inbody-csv', help='InBody app export CSV (preferred; the inbody_full sheet is read too)')
    a = ap.parse_args()
    start, end = dt.date.fromisoformat(a.start), dt.date.fromisoformat(a.end)
    os.makedirs(a.out_dir, exist_ok=True)

    wb = openpyxl.load_workbook(a.xlsx, data_only=True)
    goals = load_goals(wb)
    meals_all = load_meals(wb)
    inbody_all = load_inbody_export(wb, a.inbody_csv)
    inbody_source = 'InBody export (CSV / inbody_full sheet)'
    if not inbody_all:
        inbody_all = load_inbody(wb, a.inbody_history)
        inbody_source = 'inbody sheet + result-sheet history'

    recs = [m for m in meals_all if start.isoformat() <= m['date'] <= end.isoformat()]
    byday = collections.defaultdict(list)
    for m in recs:
        byday[m['date']].append(m)
    full = sorted(d for d, v in byday.items() if CORE <= {m['type'] for m in v})
    if not full:
        raise SystemExit(f'no full (3-meal) days between {start} and {end}; logged days: {len(byday)}')

    order = {t: i for i, t in enumerate(MEAL_TYPES)}
    days = []
    for d in full:
        v = sorted(byday[d], key=lambda m: order[m['type']])
        t = {k: sum(m[k] for m in v) for k in ['cal', 'p', 'f', 'c']}
        days.append(dict(d=d, k=round(t['cal']), p=r1(t['p']), f=r1(t['f']), c=r1(t['c']),
                         bytype={ty: round(sum(m['cal'] for m in v if m['type'] == ty)) for ty in MEAL_TYPES},
                         ptype={ty: r1(sum(m['p'] for m in v if m['type'] == ty)) for ty in MEAL_TYPES},
                         m=[[m['type'], '・'.join(m['items'][:4]) or (m['memo'] or m['note'] or '(内容なし)')[:40],
                             round(m['cal']), r1(m['p'])] for m in v]))
    full_meals = [m for m in recs if m['date'] in set(full)]

    # calendar
    cal, d = [], start
    while d <= end:
        k = d.isoformat()
        v = byday.get(k, [])
        cal.append([k, 'full' if k in set(full) else ('part' if v else 'none')])
        d += dt.timedelta(1)

    G = goals
    lo, hi = G['k'] * 0.9, G['k'] * 1.1
    kv = [x['k'] for x in days]
    avg = {k: st.mean(x[k] for x in days) for k in ['k', 'p', 'f', 'c']}
    pfc = {'p': r1(st.mean(x['p'] * 4 / x['k'] * 100 for x in days if x['k'])),
           'f': r1(st.mean(x['f'] * 9 / x['k'] * 100 for x in days if x['k'])),
           'c': r1(st.mean(x['c'] * 4 / x['k'] * 100 for x in days if x['k']))}
    pfc_goal = {'p': r1(G['p'] * 4 / G['k'] * 100), 'f': r1(G['f'] * 9 / G['k'] * 100), 'c': r1(G['c'] * 4 / G['k'] * 100)}

    # InBody in period (plus the last measurement before it, for context)
    ib = [m for m in inbody_all if start <= m['date'] <= end]
    before = [m for m in inbody_all if m['date'] < start]
    ib_weight = st.mean(m['w'] for m in ib) if ib else (inbody_all[-1]['w'] if inbody_all else None)

    def ext(key, fn):
        if not ib:
            return None
        m = fn(ib, key=lambda x: x[key])
        return {'date': m['date'].isoformat(), 'value': m[key]}

    intervals = []
    for a_, b_ in zip(ib, ib[1:]):
        span = [d for d in full if a_['date'].isoformat() < d <= b_['date'].isoformat()]
        logged = [d for d in byday if a_['date'].isoformat() < d <= b_['date'].isoformat()]
        sd = [x for x in days if x['d'] in set(span)]
        intervals.append({
            'from': a_['date'].isoformat(), 'to': b_['date'].isoformat(), 'days': (b_['date'] - a_['date']).days,
            'd_weight': r1(b_['w'] - a_['w']), 'd_fat_pct': r1(b_['fp'] - a_['fp']), 'd_muscle': r1(b_['mm'] - a_['mm']),
            'logged_days': len(logged), 'full_days': len(span),
            'avg_kcal_full': round(st.mean(x['k'] for x in sd)) if sd else None,
            'avg_p_full': r1(st.mean(x['p'] for x in sd)) if sd else None})
    gaps = [i for i in intervals if i['days'] > 21]
    # a point that jumps away from both neighbours while the neighbours agree is probably
    # measurement noise (hydration, time of day), not a real change
    outliers = []
    for p_, c_, n_ in zip(ib, ib[1:], ib[2:]):
        for key, lim in (('mm', 1.0), ('fp', 1.2)):
            if None in (p_[key], c_[key], n_[key]):
                continue
            if abs(p_[key] - n_[key]) <= lim / 2 and abs(c_[key] - p_[key]) >= lim and abs(c_[key] - n_[key]) >= lim                     and (c_[key] - p_[key]) * (c_[key] - n_[key]) > 0:
                outliers.append({'date': c_['date'].isoformat(), 'metric': key, 'value': c_[key],
                                 'neighbours': [p_[key], n_[key]]})

    # months / weekdays
    months = []
    for mo in sorted({x['d'][:7] for x in days} | {c[0][:7] for c in cal}):
        ds = [x for x in days if x['d'].startswith(mo)]
        months.append({'m': mo, 'n': len(ds), 'logged': sum(1 for c in cal if c[0].startswith(mo) and c[1] != 'none'),
                       'k': round(st.mean(x['k'] for x in ds)) if ds else None,
                       'p': r1(st.mean(x['p'] for x in ds)) if ds else None,
                       'f': r1(st.mean(x['f'] for x in ds)) if ds else None,
                       'c': r1(st.mean(x['c'] for x in ds)) if ds else None})
    wd = []
    for w in range(7):
        ds = [x for x in days if dt.date.fromisoformat(x['d']).weekday() == w]
        wd.append({'wd': WD[w], 'n': len(ds), 'k': round(st.mean(x['k'] for x in ds)) if ds else None,
                   'p': r1(st.mean(x['p'] for x in ds)) if ds else None})

    # meals by type
    by_type = {ty: {'kcal': round(st.mean(x['bytype'][ty] for x in days)), 'p': r1(st.mean(x['ptype'][ty] for x in days))}
               for ty in MEAL_TYPES}
    breakfasts = [m for m in full_meals if m['type'] == '朝食']
    bitems = collections.Counter(i for m in breakfasts for i in m['items'])
    top_name = bitems.most_common(1)[0][0] if bitems else ''
    # count breakfasts whose dishes *include* the top item (e.g. 'トースト' also matches 'ピザトースト')
    top_b = (top_name, sum(any(top_name in i for i in m['items']) for m in breakfasts) if top_name else 0)
    items = collections.Counter(i for m in full_meals for i in m['items'])
    dinners = [m for m in full_meals if m['type'] == '夕食']

    def score(x):
        return sum(abs(x[k] - G[k]) / G[k] for k in ['k', 'p', 'f', 'c'])

    best = min(days, key=score)
    mx = max(days, key=lambda x: x['k'])
    weekday_label = lambda d: WD[dt.date.fromisoformat(d).weekday()]

    stats = {
        'period': {'start': start.isoformat(), 'end': end.isoformat(), 'days': len(cal)},
        'goals': G,
        'logging': {'logged_days': len(byday), 'full_days': len(full), 'meals_on_full_days': len(full_meals),
                    'logged_pct': round(len(byday) / len(cal) * 100), 'full_pct': round(len(full) / len(cal) * 100)},
        'daily': {'avg': {k: r1(v) for k, v in avg.items()}, 'median_kcal': round(st.median(kv)),
                  'sd_kcal': round(st.pstdev(kv)), 'min_kcal': min(kv), 'max_kcal': max(kv),
                  'band': [round(lo), round(hi)], 'in_band': sum(lo <= k <= hi for k in kv),
                  'under': sum(k < lo for k in kv), 'over': sum(k > hi for k in kv),
                  'p_goal_hit_days': sum(x['p'] >= G['p'] for x in days), 'f_over_goal_days': sum(x['f'] > G['f'] for x in days),
                  'p_per_kg': r1(avg['p'] / ib_weight) if ib_weight else None},
        'pfc_pct': pfc, 'pfc_goal_pct': pfc_goal,
        'by_meal_type': by_type,
        'breakfast': {'entries': len(breakfasts), 'top_item': top_b[0], 'top_item_count': top_b[1],
                      'days_p20': sum(x['ptype']['朝食'] >= 20 for x in days), 'top_items': bitems.most_common(8)},
        'dinner': {'entries': len(dinners), 'fat35_entries': sum(m['f'] >= 35 for m in dinners),
                   'avg_fat': r1(st.mean(m['f'] for m in dinners)) if dinners else None},
        'foods': {'top_items': items.most_common(30),
                  'noodle_meals': sum(any(k in ' '.join(m['items']) for k in NOODLE) for m in full_meals),
                  'fried_meals': sum(any(k in ' '.join(m['items']) for k in FRIED) for m in full_meals)},
        'months': months, 'weekdays': wd,
        'best_day': dict(best, wd=weekday_label(best['d'])), 'max_day': dict(mx, wd=weekday_label(mx['d'])),
        'top_protein_meals': sorted([[m['date'], m['type'], round(m['cal']), r1(m['p']), m['items'][:5]] for m in full_meals],
                                    key=lambda x: -x[3])[:6],
        'top_kcal_meals': sorted([[m['date'], m['type'], round(m['cal']), r1(m['f']), m['items'][:5]] for m in full_meals],
                                 key=lambda x: -x[2])[:6],
        'inbody': {
            'source': inbody_source, 'count': len(ib), 'avg_weight': r1(ib_weight) if ib_weight else None,
            'first': ({k: (v.isoformat() if isinstance(v, dt.date) else v) for k, v in ib[0].items()} if ib else None),
            'last': ({k: (v.isoformat() if isinstance(v, dt.date) else v) for k, v in ib[-1].items()} if ib else None),
            'before_period': ({'date': before[-1]['date'].isoformat(), 'w': before[-1]['w'], 'fp': before[-1]['fp'],
                               'mm': before[-1]['mm']} if before else None),
            'muscle_max': ext('mm', max), 'muscle_min': ext('mm', min),
            'fat_pct_max': ext('fp', max), 'fat_pct_min': ext('fp', min),
            'weight_range': [min(m['w'] for m in ib), max(m['w'] for m in ib)] if ib else None,
            'date_fixes': [{'sheet_date': m['sheet_date'], 'measured': m['date'].isoformat()} for m in ib if m.get('sheet_date')],
            'possible_outliers': outliers,
            'measurements': [[m['date'].isoformat(), m.get('time'), m['w'], m['fp'], m['mm'], m.get('smm'), m.get('score')] for m in ib],
            'intervals': intervals, 'gaps_over_21d': [{'from': g['from'], 'to': g['to'], 'days': g['days']} for g in gaps]},
    }
    chart = {
        'goal': {k: G[k] for k in ['k', 'p', 'f', 'c']},
        'weight': r1(ib_weight) if ib_weight else None,
        'days': [{k: x[k] for k in ['d', 'k', 'p', 'f', 'c', 'm']} for x in days],
        'cal': cal,
        'inbody': [[m['date'].isoformat(), m['w'], m['fp'], m['mm'], m['fm'], m['bmr']] for m in ib],
        'inbody_outliers': sorted({o['date'] for o in stats['inbody']['possible_outliers']}),
        'months': months, 'weekdays': wd,
        'pfc': pfc, 'pfc_goal': pfc_goal,
        'meal_p': [[ty, by_type[ty]['p']] for ty in MEAL_TYPES],
        'meal_k': [[ty, by_type[ty]['kcal']] for ty in MEAL_TYPES],
        'counter': {'item': top_b[0], 'count': top_b[1], 'total': len(breakfasts)},
        'daily_counts': {'in': stats['daily']['in_band'], 'under': stats['daily']['under'], 'over': stats['daily']['over'],
                         'band': stats['daily']['band']},
    }
    json.dump(chart, open(os.path.join(a.out_dir, 'chart_data.json'), 'w', encoding='utf-8'), ensure_ascii=False,
              separators=(',', ':'))
    json.dump(stats, open(os.path.join(a.out_dir, 'stats.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1,
              default=str)
    write_md(stats, os.path.join(a.out_dir, 'stats.md'))
    print(open(os.path.join(a.out_dir, 'stats.md'), encoding='utf-8').read())


def write_md(s, path):
    L = []
    p, g, lg, d = s['period'], s['goals'], s['logging'], s['daily']
    L.append(f"# {p['start']} – {p['end']} ({p['days']} days)")
    L.append(f"goals ({g['source']}): {g['k']:.0f} kcal / P {g['p']:.0f} / F {g['f']:.0f} / C {g['c']:.0f}")
    L.append(f"logged {lg['logged_days']}d ({lg['logged_pct']}%), full 3-meal {lg['full_days']}d ({lg['full_pct']}%), "
             f"{lg['meals_on_full_days']} meals on full days")
    a = d['avg']
    L.append(f"avg/day: {a['k']:.0f} kcal, P {a['p']}, F {a['f']}, C {a['c']} | median {d['median_kcal']} sd {d['sd_kcal']} "
             f"min {d['min_kcal']} max {d['max_kcal']} | P/kg {d['p_per_kg']}")
    L.append(f"±10% band {d['band']}: in {d['in_band']}, under {d['under']}, over {d['over']} | "
             f"P≥goal days {d['p_goal_hit_days']}, F>goal days {d['f_over_goal_days']}")
    L.append(f"PFC % actual {s['pfc_pct']} vs goal {s['pfc_goal_pct']}")
    L.append('by meal: ' + ', '.join(f"{t} {v['kcal']}kcal P{v['p']}" for t, v in s['by_meal_type'].items()))
    b = s['breakfast']
    L.append(f"breakfast: {b['entries']} entries, top '{b['top_item']}' x{b['top_item_count']}, days with P≥20: {b['days_p20']} | "
             f"top {b['top_items']}")
    L.append(f"dinner: {s['dinner']}")
    f = s['foods']
    L.append(f"noodle meals {f['noodle_meals']}, fried {f['fried_meals']} | top items {f['top_items'][:15]}")
    L.append('months: ' + ' | '.join(f"{m['m']} n{m['n']}/log{m['logged']} {m['k']}kcal P{m['p']} F{m['f']}" for m in s['months']))
    L.append('weekdays: ' + ' | '.join(f"{w['wd']} n{w['n']} {w['k']}kcal" for w in s['weekdays']))
    bd, md = s['best_day'], s['max_day']
    L.append(f"best day {bd['d']}({bd['wd']}) {bd['k']}kcal P{bd['p']} F{bd['f']} C{bd['c']}: {bd['m']}")
    L.append(f"max day {md['d']}({md['wd']}) {md['k']}kcal P{md['p']} F{md['f']} C{md['c']}: {md['m']}")
    L.append(f"top protein meals {s['top_protein_meals']}")
    ib = s['inbody']
    L.append(f"InBody ({ib['source']}): {ib['count']} in period, avg weight {ib['avg_weight']}, first {ib['first']}, last {ib['last']}, "
             f"before {ib['before_period']}")
    L.append(f"  muscle max {ib['muscle_max']} min {ib['muscle_min']} | fat% max {ib['fat_pct_max']} min {ib['fat_pct_min']} | "
             f"date fixes {ib['date_fixes']} | gaps>21d {ib['gaps_over_21d']}")
    L.append(f"  possible outliers (one-off jumps): {ib['possible_outliers']}")
    L.append('  measurements [date, time, weight, fat%, muscle(筋肉量), skeletal(骨格筋量), score]:')
    for m in ib['measurements']:
        L.append(f'    {m}')
    for i in ib['intervals']:
        L.append(f"  {i['from']}→{i['to']} ({i['days']}d): W {i['d_weight']:+} F% {i['d_fat_pct']:+} M {i['d_muscle']:+} | "
                 f"logged {i['logged_days']} full {i['full_days']} avg {i['avg_kcal_full']}kcal P{i['avg_p_full']}")
    open(path, 'w', encoding='utf-8').write('\n'.join(L) + '\n')


if __name__ == '__main__':
    main()

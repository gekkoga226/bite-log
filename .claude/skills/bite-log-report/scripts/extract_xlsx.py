"""Turn a Google Drive MCP `download_file_content` result into an .xlsx file.

The Drive tool returns JSON like {"content": "<base64>", "mimeType": ..., "title": ...}.
When the result is large, Claude Code saves it to a tool-results .txt file instead of
showing it; pass that file path here.

usage: python extract_xlsx.py <tool-result.json|txt> <out.xlsx>
"""
import base64
import json
import sys


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    src, out = sys.argv[1], sys.argv[2]
    raw = open(src, encoding='utf-8').read().strip()
    try:
        payload = json.loads(raw)
        if isinstance(payload, list):  # some hosts wrap results in a list of content blocks
            payload = next(p for p in payload if isinstance(p, dict) and ('content' in p or 'text' in p))
            if 'text' in payload:
                payload = json.loads(payload['text'])
        b64 = payload['content']
    except (json.JSONDecodeError, KeyError, StopIteration):
        b64 = raw  # already bare base64
    data = base64.b64decode(b64)
    if data[:2] != b'PK':
        sys.exit('decoded data is not an xlsx (zip) file - check the export mime type')
    open(out, 'wb').write(data)
    print(f'wrote {out} ({len(data):,} bytes)')


if __name__ == '__main__':
    main()

"""Render the archived About documents for the website's toolbar-free reader.

Requires Poppler, Pillow, and pypdf. Originals stay outside site/assets.
Run from any directory after exporting ps326-poster.pptx to ps326-poster.pdf.
"""
from pathlib import Path
from tempfile import TemporaryDirectory
import hashlib
import json
import subprocess

from PIL import Image
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
ARCHIVE = ROOT / 'documents/about'
OUTPUT = ROOT / 'site/assets/images/about-documents'
DOCUMENTS = [
    dict(id='cv', collection='cv', title='Andre Weiss', label='Curriculum vitae',
         detail='Education, research, and experience.', file='andre-weiss-cv.pdf', size=2600),
    dict(id='conformity', collection='research',
         title='Conformity and Its Impact on Purchasing Decisions on Social Media',
         label='Research poster', detail='PS 326 · Boston University',
         file='ps326-poster.pdf', size=4800),
    dict(id='procedure-extraction', collection='research',
         title='Large language models for zero-shot procedure extraction in orthopedic surgery: a comparative evaluation',
         label='Research paper', detail='Scientific Reports · 2026 · Article in press',
         file='orthopedic-procedure-extraction.pdf', size=2600),
]


def readable_text(page, document_id):
    text = page.extract_text().replace('\x00', '')
    if document_id == 'cv':
        for icon, label in {
            '♂¶ap-¶arker-alt': 'Location:', '♂phone-alt': 'Phone:',
            '/linkedin-in': 'LinkedIn:', '/gl⌢be': 'Website:',
            '/github': 'GitHub:', '♂language': 'Languages:', '✉': 'Email:',
        }.items():
            text = text.replace(icon, label)
    return text


def main():
    manifest = {'version': 1, 'documents': []}
    for spec in DOCUMENTS:
        source = ARCHIVE / spec['file']
        reader = PdfReader(source)
        target = OUTPUT / spec['id']
        target.mkdir(parents=True, exist_ok=True)
        entry = {key: spec[key] for key in ['id', 'collection', 'title', 'label', 'detail']}
        entry['pages'] = []
        with TemporaryDirectory(prefix='axd-document-') as temporary:
            prefix = Path(temporary) / 'page'
            subprocess.run(['pdftoppm', '-scale-to', str(spec['size']), '-png', str(source), str(prefix)], check=True)
            rendered = sorted(Path(temporary).glob('page-*.png'))
            assert len(rendered) == len(reader.pages), f'Missing pages in {source.name}'
            for number, (page, png) in enumerate(zip(reader.pages, rendered), 1):
                with Image.open(png) as image:
                    # Hash the rendered content so a replacement CV also refreshes caches.
                    stamp = hashlib.sha256(png.read_bytes()).hexdigest()[:10]
                    filename = f'page-{number:02}-{stamp}.webp'
                    image.convert('RGB').save(target / filename, 'WEBP', quality=94, method=6)
                    entry['pages'].append(dict(src=f'/assets/images/about-documents/{spec["id"]}/{filename}',
                                              width=image.width, height=image.height,
                                              text=readable_text(page, spec['id'])))
                    if number == 1:
                        image.thumbnail((600, 600))
                        thumbnail = f'cover-{stamp}.webp'
                        image.convert('RGB').save(target / thumbnail, 'WEBP', quality=88, method=6)
                        entry['cover'] = f'/assets/images/about-documents/{spec["id"]}/{thumbnail}'
        manifest['documents'].append(entry)
        print(f'{spec["id"]}: {len(entry["pages"])} pages', flush=True)
    destination = ROOT / 'site/assets/data/about-documents.json'
    destination.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')


if __name__ == '__main__':
    main()

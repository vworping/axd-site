"""Build About web copies and run the existing Perceptual Palette Drift extractor.

Run with that project's Python environment; see docs/EDITING.md for the command.
Full-resolution originals stay in the ignored local archive, outside public assets.
"""
import argparse
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile

import numpy as np
from PIL import Image, ImageCms, ImageOps
from skimage import color

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--palette-project', type=Path, required=True)
parser.add_argument('--source-dir', type=Path, default=ROOT / '.local-archive/about-portraits/sources')
args = parser.parse_args()
extractor_path = args.palette_project / 'src/extract_palettes.py'
spec = importlib.util.spec_from_file_location('palette_extractor', extractor_path)
extractor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(extractor)
assets = ROOT / 'site/assets/images/about'
records = [
    ('_DSF0655', assets / '_DSF0655.webp', 'Andre Weiss in a red racing jacket, photographed in falling snow', 'Snow'),
    ('_DSF2089', args.source_dir / '_DSF2089.jpg', 'Andre Weiss in a black jacket beneath trees on a rainy city street', 'Rain'),
    ('_DSF3337', args.source_dir / '_DSF3337.JPG', 'Andre Weiss in a blue shirt and gold tie, with warm lights behind him at night', 'Night'),
]
photos, provenance, sources = [], {}, []
parameters = dict(n_sample=100_000, tau_low=10.0, tau_high=95.0, min_after_clip=10_000,
                  max_image_edge=1600, exclude_skin=False)
clustering = dict(k=5, batch_size=2048, max_iter=200, n_init=5, random_state=0)
for name, source, alt, label in records:
    with Image.open(source) as original:
        image = ImageOps.exif_transpose(original).convert('RGB')
        profile = original.info.get('icc_profile')
        if profile:
            image = ImageCms.profileToProfile(image, ImageCms.ImageCmsProfile(io.BytesIO(profile)),
                                             ImageCms.createProfile('sRGB'), outputMode='RGB')
    source_hash = hashlib.sha256(source.read_bytes()).hexdigest()
    # The snow portrait's original is no longer at its recorded Desktop path.
    # Retain its existing web files and explicitly record that extraction input.
    if name != '_DSF0655':
        for suffix, edge in [('', 1200), ('-small', 640)]:
            web = image.copy()
            web.thumbnail((edge, edge), Image.Resampling.LANCZOS)
            web.save(assets / f'{name}{suffix}.webp', quality=84, method=6, exif=b'')
    with tempfile.TemporaryDirectory() as temp:
        normalized = Path(temp) / 'oriented.png'
        image.save(normalized)
        samples, metadata = extractor.sample_lab_pixels(normalized, rng=np.random.default_rng(0), **parameters)
        weights, centers = extractor.extract_palette(samples, **clustering)
    rgb = np.rint(np.clip(color.lab2rgb(centers.reshape(1, -1, 3)), 0, 1)[0] * 255).astype(int)
    palette = [dict(hex='#' + ''.join(f'{c:02x}' for c in triplet), weight=round(float(weight), 8))
               for triplet, weight in zip(rgb, weights)]
    path = f'assets/images/about/{name}.webp'
    with Image.open(assets / f'{name}.webp') as web:
        width, height = web.size
    photos.append(dict(src='/' + path, width=width, height=height, alt=alt, label=label, palette=palette))
    sources.append(dict(src=path, source=str(source.relative_to(ROOT)), source_sha256=source_hash,
                        width=width, height=height, processing='Existing derivatives retained.' if name == '_DSF0655' else
                        'EXIF orientation applied; converted to sRGB; uncropped WebP at 1200 and 640 pixels on the long edge; metadata removed.'))
    provenance[path] = dict(source=str(source.relative_to(ROOT)), source_sha256=source_hash,
                           method='Perceptual Palette Drift: sample_lab_pixels + extract_palette; CIELAB MiniBatchKMeans, descending cluster weights, LAB centroids converted to sRGB.',
                           extractor='perceptual-palette-drift/src/extract_palettes.py',
                           extractor_sha256=hashlib.sha256(extractor_path.read_bytes()).hexdigest(),
                           rng_seed=0, parameters={**parameters, **clustering}, sampling=metadata,
                           lab_centroids=centers.tolist(), palette=palette)
    print(name, palette)
(ROOT / 'site/assets/data/about-portraits.js').write_text('// Measured palettes; regenerate with tools/prepare-about-portraits.py.\nwindow.ABOUT_PORTRAITS = ' + json.dumps(photos, indent=2) + ';\n')
for filename, changes in [('palette-provenance.json', provenance), ('image-sources.json', {'about': sources})]:
    path = ROOT / 'docs' / filename
    existing = json.loads(path.read_text())
    # Retain the historical original path without pretending it is available.
    if filename == 'image-sources.json' and isinstance(existing.get('about'), dict):
        sources[0]['original_source_record'] = existing['about']['source']
    elif filename == 'image-sources.json':
        sources[0]['original_source_record'] = existing['about'][0].get('original_source_record', '')
    existing.update(changes)
    path.write_text(json.dumps(existing, indent=2) + '\n')

from __future__ import annotations

from pathlib import Path
import json

import numpy as np
from PIL import Image
from skimage import color


PROJECTS = [
    {
        "slug": "converse-all-star",
        "folder": Path("assets/images/projects/converse"),
        "title": "All-Star Creative",
        "meta": "Converse / ICA",
        "year": "2022",
        "role": "Photography, process documentation, artist collaboration",
        "description": "Photographed Abel Teclemariam's East Coast All-Star jersey process for Converse through an ICA teen creative pathway.",
        "tags": ["creative process", "visual storytelling", "collaboration"],
        "poetic_tag": "studio shadow / jersey heat / paper white",
    },
    {
        "slug": "glow-up-for-grad",
        "folder": Path("assets/images/projects/glow up for grad"),
        "title": "Glow Up for Graduation",
        "meta": "Community Event",
        "year": "2025",
        "role": "Event photography, room-reading, image sequencing",
        "description": "Photographed eighth graders receiving hair touch-ups from Madison Park Vocational Technical High School students before graduation.",
        "tags": ["event documentation", "community", "portraiture"],
        "poetic_tag": "salon light / soft ceremony / electric care",
    },
]

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
OUT_PATH = Path("assets/data/projects.js")
K = 5
N_SAMPLE_PER_IMAGE = 30_000
RNG = np.random.default_rng(7)


def lab_to_hex(lab: np.ndarray) -> str:
    rgb = color.lab2rgb(lab.reshape(1, 1, 3)).reshape(3)
    rgb8 = np.clip(np.round(rgb * 255), 0, 255).astype(int)
    return "#{:02x}{:02x}{:02x}".format(*rgb8)


def describe_lab(lab: np.ndarray) -> str:
    l_star, a_star, b_star = lab

    if l_star < 24:
        light = "deep shadow"
    elif l_star < 48:
        light = "low light"
    elif l_star < 72:
        light = "worked midtone"
    elif l_star < 88:
        light = "soft highlight"
    else:
        light = "near white"

    if a_star < -12:
        red_green = "green pull"
    elif a_star > 18:
        red_green = "red warmth"
    elif a_star > 6:
        red_green = "skin warmth"
    else:
        red_green = "neutral axis"

    if b_star < -14:
        blue_yellow = "blue cast"
    elif b_star > 22:
        blue_yellow = "amber cast"
    elif b_star > 8:
        blue_yellow = "cream cast"
    else:
        blue_yellow = "quiet balance"

    return f"{light} / {red_green} / {blue_yellow}"


def sample_image_lab(path: Path) -> np.ndarray:
    image = Image.open(path).convert("RGB")
    rgb = np.asarray(image, dtype=np.float32) / 255.0
    lab = color.rgb2lab(rgb).reshape(-1, 3).astype(np.float32)

    n = min(N_SAMPLE_PER_IMAGE, lab.shape[0])
    sample = lab[RNG.choice(lab.shape[0], size=n, replace=False)]
    l_star = sample[:, 0]
    clipped = sample[(l_star >= 8) & (l_star <= 96)]
    return clipped if clipped.shape[0] > 2000 else sample


def project_images(folder: Path) -> list[Path]:
    images = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMG_EXTS)
    return sorted(images, key=lambda p: (0 if "cover" in p.name else 1, p.name))


def project_palette(images: list[Path]) -> tuple[np.ndarray, np.ndarray]:
    samples = np.vstack([sample_image_lab(path) for path in images])
    if samples.shape[0] > 120_000:
        samples = samples[RNG.choice(samples.shape[0], size=120_000, replace=False)]

    centers = samples[RNG.choice(samples.shape[0], size=K, replace=False)].copy()
    labels = np.zeros(samples.shape[0], dtype=np.int32)

    for _ in range(40):
        distances = np.sum((samples[:, None, :] - centers[None, :, :]) ** 2, axis=2)
        labels = np.argmin(distances, axis=1)
        next_centers = centers.copy()
        for k in range(K):
            cluster = samples[labels == k]
            if cluster.shape[0]:
                next_centers[k] = cluster.mean(axis=0)
        if np.allclose(centers, next_centers, atol=0.01):
            centers = next_centers
            break
        centers = next_centers

    weights = np.bincount(labels, minlength=K).astype(np.float32)
    weights = weights / weights.sum()
    order = np.argsort(-weights)
    return weights[order], centers[order]


def image_info(path: Path) -> dict:
    image = Image.open(path)
    width, height = image.size
    image.close()
    return {
        "src": path.as_posix(),
        "width": int(width),
        "height": int(height),
        "aspect": round(width / height, 4),
        "orientation": "landscape" if width >= height else "portrait",
    }


def main() -> None:
    rows = []

    for project in PROJECTS:
        images = project_images(project["folder"])
        if not images:
            continue

        weights, labs = project_palette(images)
        colors = []
        for rank, (weight, lab) in enumerate(zip(weights, labs), start=1):
            colors.append(
                {
                    "rank": rank,
                    "weight": round(float(weight), 4),
                    "hex": lab_to_hex(lab),
                    "lab": {
                        "l": round(float(lab[0]), 1),
                        "a": round(float(lab[1]), 1),
                        "b": round(float(lab[2]), 1),
                    },
                    "language": describe_lab(lab),
                }
            )

        cover = next((p for p in images if "cover" in p.name), images[0])
        cover_info = image_info(cover)
        rows.append(
            {
                "slug": project["slug"],
                "title": project["title"],
                "meta": project["meta"],
                "year": project["year"],
                "role": project["role"],
                "description": project["description"],
                "tags": project["tags"],
                "cover": cover_info,
                "images": [image_info(p) for p in images],
                "palette": colors,
                "poeticTag": project["poetic_tag"],
                "accent": colors[-1]["hex"],
                "wash": colors[1]["hex"] if len(colors) > 1 else colors[0]["hex"],
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        "window.PROJECTS = " + json.dumps(rows, indent=2) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

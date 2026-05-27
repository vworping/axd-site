from __future__ import annotations

from pathlib import Path
import json

import numpy as np
from PIL import Image
from skimage import color


PROJECTS = [
    {
        "slug": "converse-all-star",
        "folder": Path("assets/images/projects-web/converse"),
        "title": "All-Star Creative",
        "meta": "Converse / ICA",
        "year": "2022",
        "role": "Photography, process documentation, artist collaboration",
        "description": "Photographed Abel Teclemariam's East Coast All-Star jersey process for Converse through an ICA teen creative pathway.",
        "tags": ["creative process", "visual storytelling", "collaboration"],
        "poetic_tag": "studio shadow / jersey heat / paper white",
        "case_study": {
            "title": "Converse All-Star Creative",
            "summary": "Photography, creative coordination, and visual storytelling inside an artist-led jersey process.",
            "body": [
                "At the end of high school, the Institute of Contemporary Art connected me with Converse to document the creation of the East Coast team's jersey for the Celebrity All-Star Basketball Game. Cambridge-based artist Abel Teclemariam was designing the jersey, and my job was to capture the process while working directly alongside him and the team around him.",
                "This was an early signal. I was not just taking pictures; I was inside the creative process, adapting in real time to a live collaborative environment and helping shape how the story got told.",
                "The project later led to my selection for Converse's All-Star creative community, opening the door to ongoing projects and mentorship.",
            ],
            "facts": [
                {"label": "What I did", "value": "Process photography, on-site coordination, visual narrative"},
                {"label": "Collaborators", "value": "Abel Teclemariam, Converse, Institute of Contemporary Art"},
                {"label": "Outcome", "value": "Selected for Converse's All-Star creative community"},
            ],
        },
    },
    {
        "slug": "ica-city-headshots",
        "folder": Path("assets/images/projects-web/ica city headshots"),
        "title": "ICA x City of Boston Headshots",
        "meta": "ICA / City of Boston",
        "year": "2022",
        "role": "Headshot photography, participant coordination, image delivery",
        "description": "Coordinated and photographed professional headshots for young people connecting with employers and youth resources at a City of Boston career event.",
        "tags": ["headshots", "career access", "youth resources"],
        "poetic_tag": "public service / soft confidence / future-facing light",
        "case_study": {
            "title": "ICA x City of Boston Headshots",
            "summary": "A headshot station for youth and young adults navigating work, resources, and first professional impressions.",
            "body": [
                "The ICA and City of Boston brought youth and young adults into a free career-focused event with employers, workshops, resources, performances, food, raffles, and giveaways. Inside that larger environment, I helped coordinate a headshot station so participants could leave with a useful image for applications, profiles, and future opportunities.",
                "I worked with ICA Teen Director Betsy Gibbons on the headshot flow and the later dispersal of images. The project asked for more than a clean portrait; it required making a quick, public setup feel calm enough for people to step in, be seen, and leave with something practical.",
                "The image set follows Nurys S., Daphnee F., Elka G., and Jasmine T. with a friend across the numbered files, turning a resource table into a compact portrait archive."
            ],
            "facts": [
                {"label": "What I did", "value": "Headshot photography, participant flow, image export and delivery"},
                {"label": "Collaborators", "value": "ICA Teen Director Betsy Gibbons, ICA, City of Boston"},
                {"label": "Featured", "value": "Nurys S., Daphnee F., Elka G., Jasmine T. and friend"},
            ],
        },
    },
    {
        "slug": "moia-grad",
        "folder": Path("assets/images/projects-web/moia grad"),
        "title": "Immigrants Lead Boston Graduation",
        "meta": "City of Boston MOIA",
        "year": "2022",
        "role": "Event photography, staff coordination, image export",
        "description": "Photographed the Immigrants Lead Boston graduation for MOIA's 2022 cohort of local immigrant residents completing a civic leadership program.",
        "tags": ["civic leadership", "community", "event documentation"],
        "poetic_tag": "civic room / gathered pride / city light",
        "case_study": {
            "title": "Immigrants Lead Boston Graduation",
            "summary": "Event documentation for MOIA's civic ownership and leadership development graduation.",
            "body": [
                "The Mayor's Office for Immigrant Advancement held the Immigrants Lead Boston graduation for its 2022 cohort on February 17, 2022. The cohort brought together local immigrant residents who had completed a civic ownership and leadership development program focused on serving and leading within immigrant communities.",
                "I photographed the graduation ceremony and worked with ILB staff around the export and delivery of the final images. The work centered on documenting a public milestone with enough care to preserve the formality of the ceremony and the warmth of the people in the room.",
                "The resulting image set sits between civic record and community portrait: speakers, graduates, families, and staff sharing a room built around leadership, belonging, and local impact."
            ],
            "facts": [
                {"label": "What I did", "value": "Ceremony photography, image sequencing, export coordination"},
                {"label": "Collaborators", "value": "City of Boston MOIA and Immigrants Lead Boston staff"},
                {"label": "Context", "value": "2022 ILB graduation for local immigrant community leaders"},
            ],
        },
    },
    {
        "slug": "glow-up-for-grad",
        "folder": Path("assets/images/projects-web/glow up for grad"),
        "title": "Glow Up for Graduation",
        "meta": "Community Event",
        "year": "2025",
        "role": "Event photography, room-reading, image sequencing",
        "description": "Photographed eighth graders receiving hair touch-ups from Madison Park Vocational Technical High School students before graduation.",
        "tags": ["event documentation", "community", "portraiture"],
        "poetic_tag": "salon light / soft ceremony / electric care",
        "case_study": {
            "title": "Glow Up for Graduation",
            "summary": "Event documentation of a graduation-prep room built around care, confidence, and community skill-sharing.",
            "body": [
                "Glow Up for Graduation centered eighth graders preparing for graduation with hair touch-ups from Madison Park Vocational Technical High School students. The room had the feel of a working salon and a small ceremony at once: practical care, peer attention, and the quiet anticipation before a milestone.",
                "My role was to photograph the event while reading the room carefully, moving between process details, portraits, and the moments where students settled into being seen. The story was not just the final look; it was the exchange of care that made the day feel held.",
                "The final sequence emphasizes hands, mirrors, expressions, and the small gestures that turn a school event into a memory."
            ],
            "facts": [
                {"label": "What I did", "value": "Event photography, candid portraiture, image sequencing"},
                {"label": "Collaborators", "value": "Madison Park Vocational Technical High School students and graduating eighth graders"},
                {"label": "Focus", "value": "Graduation preparation through care, confidence, and community"},
            ],
        },
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
                "caseStudy": project.get("case_study"),
            }
        )

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        "window.PROJECTS = " + json.dumps(rows, indent=2) + ";\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()

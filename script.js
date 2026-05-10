const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const projectList = document.querySelector("#project-list");
const lightbox = document.querySelector("#lightbox");
const lightboxImage = document.querySelector(".lightbox-image");
const lightboxClose = document.querySelector(".lightbox-close");
const lightboxPrev = document.querySelector(".lightbox-prev");
const lightboxNext = document.querySelector(".lightbox-next");
const lightboxCount = document.querySelector(".lightbox-count");
let lightboxItems = [];
let activeLightboxIndex = 0;

if (navToggle && siteNav) {
  navToggle.addEventListener("click", () => {
    const isOpen = siteNav.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  siteNav.addEventListener("click", (event) => {
    if (event.target instanceof HTMLAnchorElement) {
      siteNav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.addEventListener("contextmenu", (event) => {
  const target = event.target instanceof Element ? event.target : null;

  if (target?.closest("img, video, .placeholder-image")) {
    event.preventDefault();
  }
});

document.addEventListener("dragstart", (event) => {
  const target = event.target instanceof Element ? event.target : null;

  if (target?.closest("img, video, .placeholder-image")) {
    event.preventDefault();
  }
});

const projects = window.PROJECTS || [];

function swatchesFor(project) {
  return project.palette
    .map(
      (color) =>
        `<span style="--swatch: ${color.hex}; --weight: ${Math.max(color.weight, 0.035)}" title="${color.hex}"></span>`,
    )
    .join("");
}

function paletteStudy(project) {
  return `
    <aside class="palette-study" aria-label="Palette study for ${project.title}">
      <h4>Palette study</h4>
      <p class="palette-poem">${project.poeticTag}</p>
      <div class="swatch-list">
        ${project.palette
          .map(
            (color) => `
              <div class="swatch-row">
                <span class="swatch-rank">${String(color.rank).padStart(2, "0")}</span>
                <span class="swatch" style="--swatch: ${color.hex}; --weight: ${Math.max(color.weight * 100, 3.5)}%"></span>
                <span class="swatch-percent">${Math.round(color.weight * 100)}%</span>
              </div>
            `,
          )
          .join("")}
      </div>
      <div class="lab-details">
        ${project.palette
          .map(
            (color) => `
              <p class="lab-row">
                <strong>${color.hex}</strong><br>
                ${Math.round(color.weight * 100)}% / L* ${color.lab.l} / a* ${color.lab.a} / b* ${color.lab.b}<br>
                ${color.language}
              </p>
            `,
          )
          .join("")}
      </div>
    </aside>
  `;
}

function balancedSequence(images) {
  const landscapes = images.filter((image) => image.orientation === "landscape");
  const portraits = images.filter((image) => image.orientation === "portrait");

  if (landscapes.length >= 2 && portraits.length >= 1) return [landscapes[0], portraits[0], landscapes[1]];
  if (portraits.length >= 2 && landscapes.length >= 1) return [portraits[0], landscapes[0], portraits[1]];

  return images;
}

function imageButton(image, alt, className = "") {
  return `
    <button class="image-button ${className}" type="button" data-full="${image.src}" data-alt="${alt}" data-project-gallery>
      <img src="${image.src}" alt="${alt}" loading="lazy" style="--image-aspect: ${image.aspect}">
    </button>
  `;
}

function renderProjects() {
  if (!projectList || !projects.length) return;

  projectList.innerHTML = projects
    .map((project, index) => {
      const accent = project.accent || project.palette[project.palette.length - 1]?.hex || "#111111";
      const wash = project.wash || project.palette[1]?.hex || "#e7e2d9";
      const supportingImages = balancedSequence(project.images.filter((image) => image.src !== project.cover.src)).slice(0, 3);
      const strip = supportingImages
        .map((image, imageIndex) => imageButton(image, `${project.title} supporting image ${imageIndex + 1}`))
        .join("");

      return `
        <article class="project-row" data-project="${project.slug}" style="--project-accent: ${accent}; --project-wash: ${wash}">
          <div class="project-palette-bar" aria-label="${project.title} palette">
            ${swatchesFor(project)}
          </div>
          <div class="project-media">
            <div class="project-image-wrap" style="--cover-aspect: ${project.cover.aspect}">
              ${imageButton(project.cover, project.title, "project-cover-button")}
            </div>
            <div class="image-strip" aria-label="${project.title} image sequence">
              ${strip}
            </div>
          </div>
          <div class="project-info">
            <div class="project-identity">
              <p>${String(index + 1).padStart(2, "0")} / ${project.meta} / ${project.year}</p>
              <h3>${project.title}</h3>
              <p class="project-description">${project.description}</p>
              <ul class="tag-list" aria-label="Project tags">
                ${project.tags.map((tag) => `<li>${tag}</li>`).join("")}
              </ul>
            </div>
            ${paletteStudy(project)}
          </div>
        </article>
      `;
    })
    .join("");

  updateActiveAccent(projects[0]);
  observeProjects();
}

function setLightboxImage(index) {
  if (!lightboxImage || !lightboxItems.length) return;

  activeLightboxIndex = (index + lightboxItems.length) % lightboxItems.length;
  const item = lightboxItems[activeLightboxIndex];

  lightboxImage.src = item.src;
  lightboxImage.alt = item.alt;

  if (lightboxCount) {
    lightboxCount.textContent = `${activeLightboxIndex + 1} / ${lightboxItems.length}`;
  }
}

function openLightbox(trigger) {
  if (!lightbox || !lightboxImage) return;

  const projectRow = trigger.closest(".project-row");
  lightboxItems = [...(projectRow?.querySelectorAll("[data-project-gallery]") || [])].map((button) => ({
    src: button.dataset.full,
    alt: button.dataset.alt || "Expanded project image",
  }));
  activeLightboxIndex = Math.max(
    0,
    lightboxItems.findIndex((item) => item.src === trigger.dataset.full),
  );

  lightbox.hidden = false;
  document.body.classList.add("is-lightbox-open");
  setLightboxImage(activeLightboxIndex);
  lightboxClose?.focus();
}

function closeLightbox() {
  if (!lightbox || !lightboxImage) return;

  lightbox.hidden = true;
  lightboxImage.src = "";
  lightboxImage.alt = "";
  if (lightboxCount) lightboxCount.textContent = "";
  document.body.classList.remove("is-lightbox-open");
  lightboxItems = [];
  activeLightboxIndex = 0;
}

function showAdjacentLightboxImage(direction) {
  if (!lightboxItems.length) return;
  setLightboxImage(activeLightboxIndex + direction);
}

document.addEventListener("click", (event) => {
  const target = event.target instanceof Element ? event.target : null;
  const imageTrigger = target?.closest(".image-button");

  if (imageTrigger) {
    openLightbox(imageTrigger);
    return;
  }

  if (event.target === lightbox) {
    closeLightbox();
  }
});

lightboxClose?.addEventListener("click", closeLightbox);
lightboxPrev?.addEventListener("click", () => showAdjacentLightboxImage(-1));
lightboxNext?.addEventListener("click", () => showAdjacentLightboxImage(1));

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox && !lightbox.hidden) {
    closeLightbox();
  }

  if (event.key === "ArrowLeft" && lightbox && !lightbox.hidden) {
    showAdjacentLightboxImage(-1);
  }

  if (event.key === "ArrowRight" && lightbox && !lightbox.hidden) {
    showAdjacentLightboxImage(1);
  }
});

function updateActiveAccent(project) {
  if (!project) return;
  document.documentElement.style.setProperty("--active-accent", project.accent || project.palette.at(-1)?.hex || "#111111");
}

function observeProjects() {
  const rows = [...document.querySelectorAll(".project-row")];
  if (!rows.length) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const active = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

      if (!active) return;

      rows.forEach((row) => row.classList.remove("is-active"));
      active.target.classList.add("is-active");

      const project = projects.find((item) => item.slug === active.target.dataset.project);
      updateActiveAccent(project);
    },
    { rootMargin: "-20% 0px -35% 0px", threshold: [0.2, 0.45, 0.7] },
  );

  rows.forEach((row, index) => {
    if (index === 0) row.classList.add("is-active");
    observer.observe(row);
  });
}

renderProjects();

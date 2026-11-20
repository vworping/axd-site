(() => {
  'use strict';
  const form = document.getElementById('kitchen-form');
  const fields = document.getElementById('kitchen-fields');
  const mediaInput = document.getElementById('kitchen-photo');
  const preview = document.getElementById('kitchen-media-preview');
  const status = document.getElementById('kitchen-form-status');
  const connection = document.getElementById('kitchen-editor-status');
  const existingSelect = document.getElementById('kitchen-existing');
  const submit = form.querySelector('[type="submit"]');
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel('axd-kitchen') : null;
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm'];
  let entries = [], token, submissionId, editing, urls = [];
  const field = name => form.elements.namedItem(name);

  function populate() {
    existingSelect.replaceChildren(new Option('New dish', ''), ...entries.map(entry => new Option(entry.title, entry.id)));
  }
  async function connect() {
    try {
      const response = await fetch('/__local/kitchen', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      token = data.token;
      entries = data.entries;
      populate();
      fields.disabled = false;
      connection.textContent = '';
    } catch (error) { connection.textContent = error.message || 'Start the local preview to use this editor, then refresh.'; }
  }
  connect();

  function clearPreview() {
    preview.querySelectorAll('video').forEach(video => video.pause());
    urls.forEach(url => URL.revokeObjectURL(url));
    urls = [];
    preview.replaceChildren();
  }
  function renderPreview() {
    clearPreview();
    const current = editing?.media || (editing?.photo ? [{ ...editing.photo, type: 'image' }] : []);
    const incoming = [...mediaInput.files].map(file => {
      const src = URL.createObjectURL(file);
      urls.push(src);
      return { src, type: file.type.startsWith('video/') ? 'video' : 'image', alt: file.name, incoming: true };
    });
    [...current, ...incoming].forEach((item, index) => {
      const figure = document.createElement('figure');
      const media = document.createElement(item.type === 'video' ? 'video' : 'img');
      media.src = item.src;
      if (item.type === 'video') { media.controls = true; media.playsInline = true; media.preload = 'metadata'; }
      else media.alt = item.alt || 'Dish preview';
      const caption = document.createElement('figcaption');
      caption.textContent = `${index + 1} · ${item.type === 'video' ? 'Video' : 'Photo'}${item.incoming ? ' · new' : ''}`;
      figure.append(media, caption);
      preview.append(figure);
    });
  }
  function selectEntry() {
    form.reset();
    status.textContent = '';
    submissionId = null;
    editing = entries.find(entry => entry.id === existingSelect.value);
    mediaInput.required = !editing;
    mediaInput.setCustomValidity('');
    for (const name of ['title', 'kind', 'description', 'alt', 'ingredients', 'method']) {
      const value = editing?.[name] ?? editing?.recipe?.[name] ?? (name === 'alt' ? editing?.media?.[0]?.alt || editing?.photo?.alt : '');
      if (value) field(name).value = value;
    }
    form.querySelector('.kitchen-recipe-fields').open = Boolean(editing?.recipe);
    submit.textContent = editing ? 'Save changes' : 'Add to the kitchen';
    renderPreview();
  }
  existingSelect.addEventListener('change', selectEntry);
  document.getElementById('kitchen-clear').addEventListener('click', () => {
    existingSelect.value = '';
    selectEntry();
    field('title').focus();
  });
  mediaInput.addEventListener('change', () => {
    status.textContent = '';
    mediaInput.setCustomValidity('');
    const files = [...mediaInput.files];
    const count = (editing?.media?.length || (editing?.photo ? 1 : 0)) + files.length;
    if (count > 12 || files.some(file => !allowed.includes(file.type) || file.size > 20 * 1024 * 1024)) {
      mediaInput.setCustomValidity('Choose up to 12 JPG, PNG, WebP, MP4, or WebM files per dish, under 20 MB each.');
      mediaInput.reportValidity();
      clearPreview();
      return;
    }
    renderPreview();
  });
  async function prepare(file) {
    const url = URL.createObjectURL(file);
    let video;
    try {
      if (file.type.startsWith('video/')) {
        video = document.createElement('video');
        video.preload = 'metadata';
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Video metadata timed out')), 15000);
          video.onloadedmetadata = () => { clearTimeout(timeout); resolve(); };
          video.onerror = () => { clearTimeout(timeout); reject(new Error('Unsupported video')); };
          video.src = url;
        });
        if (!video.videoWidth || !video.videoHeight) throw new Error('No video track');
        return { blob: file, width: video.videoWidth, height: video.videoHeight };
      }
      const image = new Image();
      image.src = url;
      await image.decode();
      const scale = Math.min(1, 1800 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext('2d');
      context.fillStyle = '#f8f7f3';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .88));
      if (!blob) throw new Error('Image conversion failed');
      return { blob, width: canvas.width, height: canvas.height };
    } catch { throw new Error(`“${file.name}” could not be opened. Use a JPG, PNG, WebP, or browser-playable MP4/WebM.`); }
    finally {
      if (video) { video.removeAttribute('src'); video.load(); }
      URL.revokeObjectURL(url);
    }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (fields.disabled || !token || !form.reportValidity()) return;
    const data = new FormData(form);
    data.delete('media');
    const files = [...mediaInput.files];
    submissionId ||= crypto.randomUUID();
    data.set('submissionId', submissionId);
    if (editing) data.set('entryId', editing.id);
    fields.disabled = true;
    existingSelect.disabled = true;
    form.setAttribute('aria-busy', 'true');
    try {
      const info = [];
      let total = 0;
      for (const [index, file] of files.entries()) {
        status.textContent = `Preparing ${index + 1} of ${files.length}…`;
        const media = await prepare(file);
        total += media.blob.size;
        if (total > 60 * 1024 * 1024) throw new Error('Keep the combined upload under 60 MB.');
        const ext = { 'image/webp': 'webp', 'image/png': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm' }[media.blob.type];
        data.append('media', media.blob, `dish-${index + 1}.${ext}`);
        info.push({ width: media.width, height: media.height });
      }
      data.set('mediaInfo', JSON.stringify(info));
      status.textContent = 'Saving to your kitchen…';
      const response = await fetch('/__local/kitchen', { method: 'POST', headers: { 'X-Kitchen-Token': token }, body: data });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The dish could not be saved. Please try again.');
      const wasEditing = Boolean(editing);
      entries = editing ? entries.map(entry => entry.id === result.entry.id ? result.entry : entry) : [result.entry, ...entries];
      populate();
      existingSelect.value = result.entry.id;
      selectEntry();
      channel?.postMessage({ updated: result.entry.id });
      status.textContent = `${wasEditing ? 'Updated' : 'Added'} “${result.entry.title}”. Saved to your project.`;
    } catch (error) {
      status.textContent = error.message || 'The dish could not be saved. Your draft is still here.';
    } finally {
      fields.disabled = false;
      existingSelect.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
})();

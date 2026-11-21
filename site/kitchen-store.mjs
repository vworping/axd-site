import { mkdir, readFile, rename, writeFile, unlink } from 'node:fs/promises';
import { randomBytes, randomUUID } from 'node:crypto';
import { join } from 'node:path';

export const KITCHEN_BODY_LIMIT = 64 * 1024 * 1024;
const PHOTO_LIMIT = 8 * 1024 * 1024;
const VIDEO_LIMIT = 20 * 1024 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class InputError extends Error {}
const json = (value, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});
function textField(form, name, max, required = false) {
  const value = form.get(name);
  if (value !== null && typeof value !== 'string') throw new InputError(`Invalid ${name}.`);
  const text = (value || '').replace(/\r\n?/g, '\n').trim();
  if (required && !text) throw new InputError(`Please add a ${name}.`);
  if (text.length > max) throw new InputError(`${name} is too long.`);
  return text;
}
function mediaExtension(bytes, type) {
  if (type === 'video/mp4' && bytes.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  if (type === 'video/webm' && bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return 'webm';
  if (type === 'image/webp' && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (type === 'image/jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (type === 'image/png' && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  throw new InputError('Choose JPG, PNG, WebP, MP4, or WebM files.');
}

// This module is used only by preview.mjs, never copied into the public build.
export function createKitchenHandler({ directory, origins }) {
  const allowedOrigins = new Set(origins);
  const token = randomBytes(24).toString('hex');
  const dataPath = join(directory, 'assets/data/kitchen.json');
  const mediaDirectory = join(directory, 'assets/media/kitchen');
  let writes = Promise.resolve();

  async function read() {
    const data = JSON.parse(await readFile(dataPath, 'utf8'));
    if (data.version !== 1 || !Array.isArray(data.entries)) throw new Error('Invalid kitchen data');
    return data;
  }
  async function save(form) {
    const title = textField(form, 'title', 100, true);
    const description = textField(form, 'description', 20000, true);
    const kind = textField(form, 'kind', 20, true);
    if (!['baking', 'cooking'].includes(kind)) throw new InputError('Choose baking or cooking.');
    const submissionId = textField(form, 'submissionId', 36, true);
    const entryId = textField(form, 'entryId', 36);
    if (!uuid.test(submissionId) || (entryId && !uuid.test(entryId))) throw new InputError('Please reload the page and try again.');
    const id = entryId || submissionId;
    // The read and every following write happen inside the same serial queue.
    const data = await read();
    const existing = data.entries.find(entry => entry.id === id);
    if (entryId && !existing) throw new InputError('This dish could not be found. Refresh the editor.');
    if (existing && (existing.submissionId === submissionId || (!entryId && existing.id === submissionId))) return existing;
    const ingredients = textField(form, 'ingredients', 8000);
    const method = textField(form, 'method', 20000);
    const alt = textField(form, 'alt', 300) || title;
    const files = form.getAll('media');
    const previousMedia = existing?.media || (existing?.photo ? [{ ...existing.photo, type: 'image' }] : []);
    if (files.length + previousMedia.length === 0 || files.length + previousMedia.length > 12) throw new InputError('Each dish can have between 1 and 12 photos or videos.');
    let info;
    try { info = JSON.parse(textField(form, 'mediaInfo', 10000, true)); }
    catch { throw new InputError('Please choose the photos or videos again.'); }
    if (!Array.isArray(info) || info.length !== files.length) throw new InputError('Please choose the photos or videos again.');
    const uploads = [];
    for (const [index, file] of files.entries()) {
      if (!file || typeof file.arrayBuffer !== 'function' || !file.size) throw new InputError('A media file is missing.');
      const type = file.type.startsWith('video/') ? 'video' : 'image';
      if (file.size > (type === 'video' ? VIDEO_LIMIT : PHOTO_LIMIT)) throw new InputError(type === 'video' ? 'Keep each video under 20 MB.' : 'Keep each optimized photo under 8 MB.');
      const { width, height } = info[index] || {};
      if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 8192)) throw new InputError('A photo or video could not be read. Please choose it again.');
      const bytes = Buffer.from(await file.arrayBuffer());
      const extension = mediaExtension(bytes, file.type);
      const filename = `${submissionId}-${index + 1}.${extension}`;
      uploads.push({ path: join(mediaDirectory, filename), bytes, media: { type, src: `/assets/media/kitchen/${filename}`, width, height, alt } });
    }
    if (uploads.reduce((sum, upload) => sum + upload.bytes.length, 0) > 60 * 1024 * 1024) throw new InputError('Keep the combined upload under 60 MB.');

    const entry = { id, submissionId, title, description, kind, createdAt: existing?.createdAt || new Date().toISOString(), media: [...previousMedia.map(item => ({ ...item, alt })), ...uploads.map(upload => upload.media)] };
    if (existing) entry.updatedAt = new Date().toISOString();
    if (ingredients || method) entry.recipe = { ingredients, method };
    const temporary = `${dataPath}.${randomUUID()}.tmp`;
    const written = [];
    await mkdir(mediaDirectory, { recursive: true });
    try {
      for (const upload of uploads) {
        await writeFile(upload.path, upload.bytes, { flag: 'wx' });
        written.push(upload.path);
      }
      const entries = existing ? data.entries.map(dish => dish.id === id ? entry : dish) : [entry, ...data.entries];
      await writeFile(temporary, JSON.stringify({ ...data, entries }, null, 2) + '\n', { flag: 'wx' });
      await rename(temporary, dataPath);
    } catch (error) {
      await Promise.allSettled([...written, temporary].map(path => unlink(path)));
      throw error;
    }
    return entry;
  }

  return async request => {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin');
    if (!allowedOrigins.has(url.origin) || request.headers.get('Host') !== url.host ||
        (origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
      return json({ error: 'Open the editor from the local preview.' }, 403);
    }
    if (request.method === 'GET') {
      try { return json({ ...(await read()), token }); }
      catch { return json({ error: 'The kitchen collection could not be read. Your saved entries have not been changed.' }, 500); }
    }
    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
    if (origin !== url.origin || request.headers.get('X-Kitchen-Token') !== token) return json({ error: 'Reload the local preview before saving.' }, 403);
    if (!request.headers.get('Content-Type')?.startsWith('multipart/form-data;')) return json({ error: 'Please submit the dish form.' }, 415);
    if (Number(request.headers.get('Content-Length')) > KITCHEN_BODY_LIMIT) return json({ error: 'This upload is too large.' }, 413);
    let form;
    try { form = await request.formData(); }
    catch { return json({ error: 'The upload could not be read. Please choose the files again.' }, 400); }
    const pending = writes.then(() => save(form));
    writes = pending.catch(() => {});
    try { return json({ entry: await pending }, 201); }
    catch (error) {
      return json({ error: error instanceof InputError ? error.message : 'The dish could not be saved. Your existing collection is unchanged; please try again.' }, error instanceof InputError ? 400 : 500);
    }
  };
}

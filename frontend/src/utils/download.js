export function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadJson(filename, data) {
  downloadText(filename, JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
}

export function safeFilename(name = 'export') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

import { apiFetch } from '../api-client';

async function downloadBlob(path: string, filename: string) {
  const res = await apiFetch(path, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text();
    let err: { error?: string } = {};
    try {
      err = JSON.parse(text);
    } catch {
      err = { error: text || res.statusText };
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function exportAsCSV(): Promise<void> {
  await downloadBlob('/export/csv', 'knowledge_graph.csv');
}

export async function exportAsJSON(): Promise<void> {
  await downloadBlob('/export/json', 'knowledge_graph.json');
}

export async function exportAsJSONL(): Promise<void> {
  await downloadBlob('/export/jsonl', 'knowledge_graph.jsonl');
}

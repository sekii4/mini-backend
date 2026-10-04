import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const quarantineFile = path.resolve('logs/quarantine.jsonl');

export async function writeQuarantineEntry(entry) {
  await mkdir(path.dirname(quarantineFile), { recursive: true });
  await appendFile(quarantineFile, `${JSON.stringify(entry)}\n`, 'utf8');
}
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const textExtensions = new Set(['', '.css', '.html', '.js', '.json', '.jsx', '.md', '.mjs', '.txt', '.yaml', '.yml']);
const patterns = [
  { label: 'macOS private path', expression: /\/Users\/[A-Za-z0-9._-]+\// },
  { label: 'Linux private path', expression: /\/home\/[A-Za-z0-9._-]+\// },
  { label: 'OpenAI-style secret', expression: /\bsk-[A-Za-z0-9_-]{16,}\b/ },
  { label: 'NVIDIA API secret', expression: /\bnvapi-[A-Za-z0-9_-]{24,}\b/ },
  { label: 'GitHub token', expression: /\b(?:gh[opusr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/ },
  { label: 'authorization header', expression: /authorization\s*[:=]\s*(?:bearer\s+)?[A-Za-z0-9._-]{16,}/i },
  { label: 'Codex rollout record', expression: /rollout-\d{4}-\d{2}-\d{2}T|\.codex\/sessions\// },
];

let files;
try {
  files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0').filter(Boolean);
} catch {
  throw new Error('privacy scan requires a Git repository');
}

const findings = [];
for (const file of files) {
  if (!textExtensions.has(extname(file).toLowerCase())) continue;
  let content;
  try { content = await readFile(resolve(root, file), 'utf8'); } catch { continue; }
  for (const pattern of patterns) {
    if (pattern.expression.test(content)) findings.push(`${file}: ${pattern.label}`);
  }
}
if (findings.length > 0) throw new Error(`privacy scan failed:\n${findings.join('\n')}`);
console.log(`privacy scan passed for ${files.length} publishable files`);

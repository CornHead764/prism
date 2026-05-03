import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

/**
 * Run SQL against the Prism database via docker exec.
 * Uses a temp file piped to stdin to avoid shell escaping issues on Windows.
 */
function runSQL(sql: string) {
  const tmpFile = join(tmpdir(), `prism-e2e-${Date.now()}.sql`);
  writeFileSync(tmpFile, sql, 'utf-8');
  const dbName = process.env.E2E_DB_NAME || 'prism';
  try {
    execSync(`docker exec -i prism-db psql -U prism -d ${dbName} < "${tmpFile}"`, {
      stdio: 'pipe',
      shell: 'cmd.exe',
    });
  } finally {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
  }
}

/**
 * Flush Redis to clear sessions and caches.
 */
function flushRedis() {
  execSync('docker exec prism-redis redis-cli FLUSHDB', { stdio: 'pipe' });
}

/**
 * Reset tasks to seed state (uncomplete all except known-completed ones).
 */
export function resetTasks() {
  runSQL(`
    UPDATE tasks SET completed = false, completed_at = NULL, completed_by = NULL
      WHERE completed = true;
  `);
}

/**
 * Reset all shopping items to unchecked.
 */
export function resetShoppingItems() {
  runSQL(`UPDATE shopping_items SET checked = false;`);
}

/**
 * Clear recent chore completions (last day).
 */
export function resetChoreCompletions() {
  runSQL(`DELETE FROM chore_completions WHERE completed_at > now() - interval '1 day';`);
}

/**
 * Disable away mode and babysitter mode.
 */
export function resetModes() {
  runSQL(`DELETE FROM settings WHERE key IN ('awayMode', 'babysitterMode');`);
}

/**
 * Full reset: flush Redis + reset all test-relevant data.
 */
export function resetAll() {
  flushRedis();
  resetTasks();
  resetShoppingItems();
  resetChoreCompletions();
  resetModes();
}

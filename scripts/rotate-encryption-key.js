#!/usr/bin/env node
/**
 * Encryption Key Rotation Script
 *
 * Re-encrypts all AES-256-GCM-protected OAuth tokens in the database
 * from an old key to a new key. Run this when rotating ENCRYPTION_KEY.
 *
 * USAGE:
 *   OLD_ENCRYPTION_KEY=<old-64-hex-chars> \
 *   NEW_ENCRYPTION_KEY=<new-64-hex-chars> \
 *   DATABASE_URL=postgresql://prism:<pass>@localhost:5433/prism \
 *   node scripts/rotate-encryption-key.js [--dry-run]
 *
 * PROCESS:
 *   1. Reads every OAuth token column that uses encrypt()
 *   2. Decrypts with OLD_ENCRYPTION_KEY
 *   3. Re-encrypts with NEW_ENCRYPTION_KEY
 *   4. Writes back to DB in a single transaction
 *   5. After success: update ENCRYPTION_KEY in .env to NEW_ENCRYPTION_KEY
 *
 * SAFETY:
 *   - Dry run mode (--dry-run) prints affected row counts without writing
 *   - Wraps all writes in a single transaction; aborts on any error
 *   - Old key is never written to disk
 */

'use strict';

const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const { Client } = require('pg');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DRY_RUN = process.argv.includes('--dry-run');

// ---------------------------------------------------------------------------
// Crypto helpers (mirror of src/lib/utils/crypto.ts — must stay in sync)
// ---------------------------------------------------------------------------

function parseKey(hexKey, label) {
  if (!hexKey) throw new Error(`${label} is required`);
  const buf = Buffer.from(hexKey, 'hex');
  if (buf.length !== 32) throw new Error(`${label} must be 64 hex characters (32 bytes)`);
  return buf;
}

function decryptWith(encoded, key) {
  const data = Buffer.from(encoded, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function encryptWith(plaintext, key) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

function isEncrypted(value) {
  if (!value) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length > IV_LENGTH + AUTH_TAG_LENGTH;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Columns that store encrypted OAuth tokens
// { table, column, idColumn }
// ---------------------------------------------------------------------------

const ENCRYPTED_COLUMNS = [
  { table: 'calendar_sources', column: 'access_token',  idColumn: 'id' },
  { table: 'calendar_sources', column: 'refresh_token', idColumn: 'id' },
  { table: 'task_sources',     column: 'access_token',  idColumn: 'id' },
  { table: 'task_sources',     column: 'refresh_token', idColumn: 'id' },
  { table: 'photo_sources',    column: 'access_token',  idColumn: 'id' },
  { table: 'photo_sources',    column: 'refresh_token', idColumn: 'id' },
];

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const oldKey = parseKey(process.env.OLD_ENCRYPTION_KEY, 'OLD_ENCRYPTION_KEY');
  const newKey = parseKey(process.env.NEW_ENCRYPTION_KEY, 'NEW_ENCRYPTION_KEY');
  const dbUrl  = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL is required');

  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE'}`);
  console.log(`Rotating ${ENCRYPTED_COLUMNS.length} column definitions across tables...\n`);

  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  try {
    let totalRows = 0;

    await client.query('BEGIN');

    for (const { table, column, idColumn } of ENCRYPTED_COLUMNS) {
      const { rows } = await client.query(
        `SELECT ${idColumn}, ${column} FROM ${table} WHERE ${column} IS NOT NULL`
      );

      let updated = 0;
      for (const row of rows) {
        const value = row[column];
        if (!isEncrypted(value)) continue; // skip nulls or non-encrypted values

        let plaintext;
        try {
          plaintext = decryptWith(value, oldKey);
        } catch {
          console.warn(`  WARN: Could not decrypt ${table}.${column} for id=${row[idColumn]} — skipping row`);
          continue;
        }

        const reEncrypted = encryptWith(plaintext, newKey);

        if (!DRY_RUN) {
          await client.query(
            `UPDATE ${table} SET ${column} = $1 WHERE ${idColumn} = $2`,
            [reEncrypted, row[idColumn]]
          );
        }
        updated++;
      }

      if (updated > 0) {
        console.log(`  ${table}.${column}: ${updated} row(s) ${DRY_RUN ? 'would be' : ''} rotated`);
        totalRows += updated;
      }
    }

    if (DRY_RUN) {
      await client.query('ROLLBACK');
      console.log(`\nDry run complete. ${totalRows} row(s) would be rotated. No changes written.`);
    } else {
      await client.query('COMMIT');
      console.log(`\nKey rotation complete. ${totalRows} row(s) updated.`);
      console.log('\nNext step: update ENCRYPTION_KEY in .env to your NEW_ENCRYPTION_KEY value,');
      console.log('then restart the app container: docker-compose restart app');
    }
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Key rotation failed:', err.message);
  process.exit(1);
});

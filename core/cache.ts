import { createHash } from 'node:crypto';
import type { WorkspacePackage } from './workspace';
import path from 'node:path';
import fs from 'node:fs/promises';
import { fileExists } from '../utils/file-exists.js';
import { runExec } from '../utils/run-script.js';
import { crossImport } from '../utils/cross-import.js';

const Database = await crossImport({
    bun: 'bun:sqlite',
    node: 'better-sqlite3',
});
const db = new Database('cache.sqlite');

db.exec('CREATE TABLE IF NOT EXISTS cache (hash TEXT PRIMARY KEY,package TEXT NOT NULL,script TEXT NOT NULL,timestamp INTEGER NOT NULL,status TEXT NOT NULL);');

export type ScriptStatus = 'success' | 'error' | 'skipped';

export type CacheRow = {
    hash: string;
    package: string;
    script: string;
    timestamp: number;
    status: ScriptStatus;
};

export const generateHash = async (pkg: WorkspacePackage, script: string) => {
    const hash = createHash('sha256');
    
    // Add script name
    hash.update(script);

    // Add package name
    hash.update(pkg.name);

    // Add package version if available
    const pkgJsonRaw = await fs.readFile(pkg.packageJsonPath, 'utf-8');
    const pkgJson = JSON.parse(pkgJsonRaw);
    if (pkgJson.version) {
        hash.update(pkgJson.version);
    }

    // Add relevant source files
    const files = await runExec(`git ls-files ${pkg.dir}`);
    if (files) {
        const fileList = files.trim().split('\n');
    
        for (const file of fileList) {
            const fullPath = path.join(pkg.dir, file);
            if (await fileExists(fullPath)) {
                const content = await fs.readFile(fullPath, 'utf-8');
                hash.update(content);
            }
        }
    }

    return hash.digest('hex');
};

export const writeCache = (hash: string, pkg: WorkspacePackage, script: string, status: ScriptStatus) => {
    const timestamp = Date.now();
    const stmt = db.prepare(`
        INSERT INTO cache (hash, package, script, timestamp, status)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(hash) DO UPDATE SET
            package = excluded.package,
            script = excluded.script,
            timestamp = excluded.timestamp,
            status = excluded.status;
    `);
    stmt.run(hash, pkg.name, script, timestamp, status);
    console.log(`Cache written for ${pkg.name} - ${script} with hash ${hash}`);
};

export const readCache = (hash: string) => {
    const stmt = db.prepare(`SELECT * FROM cache WHERE hash = ?`);
    const row = stmt.get(hash) as CacheRow | undefined;
    if (row) {
        return {
            package: row.package,
            script: row.script,
            timestamp: row.timestamp,
            status: row.status,
        };
    } else {
        return null;
    }
};

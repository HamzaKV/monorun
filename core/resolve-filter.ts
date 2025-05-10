import { execSync } from 'node:child_process';
import { minimatch } from 'minimatch';
import type { WorkspacePackage } from './workspace';
import { Graph } from 'graphlib';
import { join } from 'node:path';

const gitRangeRegex = /^\[([^\]]+)\]$/;

export const getChangedPackages = (root: string, packages: Map<string, WorkspacePackage>, baseRef = 'HEAD') => {
    const output = execSync(`git diff --name-only ${baseRef}`, { cwd: root }).toString();
    const changedFiles = output.split('\n').filter(Boolean);
    const changed = new Set<string>();

    for (const file of changedFiles) {
        const absPath = join(root, file);
        for (const [name, pkg] of packages) {
            if (absPath.startsWith(pkg.dir)) {
                changed.add(name);
            }
        }
    }

    return changed;
};

export const getChangedPackagesFromRange = (
    root: string,
    packages: Map<string, WorkspacePackage>,
    range: string
) => {
    const diffRange = parseDiffRange(range); // e.g. "main...feature" or "HEAD^1"
    const output = execSync(`git diff --name-only ${diffRange}`, { cwd: root }).toString();
    const changedFiles = output.split('\n').filter(Boolean);
    const changed = new Set<string>();

    for (const file of changedFiles) {
        const absPath = join(root, file);
        for (const [name, pkg] of packages) {
            if (absPath.startsWith(pkg.dir)) {
                changed.add(name);
            }
        }
    }

    return changed;
};

const parseDiffRange = (input: string) => {
    // Normalize common cases
    if (input.includes('...')) return input;
    if (input.includes('..')) return input; // e.g., a..b
    return `${input}...HEAD`; // Assume HEAD vs. given ref
};

export type FilterMode = 'or' | 'and';

interface ResolveFilterOptions {
    filter: string[];
    graph: Graph;
    packages: Map<string, WorkspacePackage>;
    root: string;
    mode?: FilterMode;
}

export const resolveFilter = ({
    filter,
    graph,
    packages,
    root,
    mode = 'or',
}: ResolveFilterOptions) => {
    const matchedSets: Set<string>[] = [];

    for (let raw of filter) {
        const included = new Set<string>();
        let mode: 'normal' | 'upstream' | 'downstream' = 'normal';
        let negate = false;

        // Handle downstream/upstream syntax
        if (raw.endsWith('...')) {
            mode = 'downstream';
            raw = raw.slice(0, -3);
        } else if (raw.startsWith('...')) {
            mode = 'upstream';
            raw = raw.slice(3);
        }

        // Handle negation
        if (raw.startsWith('!')) {
            negate = true;
            raw = raw.slice(1);
        }

        // Handle git diff range syntax
        const gitMatch = gitRangeRegex.exec(raw);
        if (gitMatch) {
            const range = gitMatch[1];
            const changed = getChangedPackagesFromRange(root, packages, range);
            for (const name of changed) {
                included.add(name);
            }
            continue;
        }

        // Match name or glob
        const matching = Array.from(packages.keys()).filter(name => {
            return raw.includes('*') ? minimatch(name, raw) : name === raw;
        });

        for (const match of matching) {
            if (negate) {
                included.delete(match);
            } else {
                included.add(match);

                if (mode === 'upstream') {
                    for (const node of getReachable(graph, match, 'upstream')) {
                        included.add(node);
                    }
                } else if (mode === 'downstream') {
                    for (const node of getReachable(graph, match, 'downstream')) {
                        included.add(node);
                    }
                }
            }
        }

        if (included.size) {
            matchedSets.push(included);
        }
    }

    // Combine sets based on mode
    if (mode === 'or') {
        const union = new Set<string>();
        for (const s of matchedSets) for (const val of s) union.add(val);
        return union;
    } else {
        // Intersect all sets
        if (matchedSets.length === 0) return new Set();
        return matchedSets.reduce((a, b) => new Set([...a].filter(x => b.has(x))));
    }
};

const getReachable = (graph: Graph, root: string, direction: 'upstream' | 'downstream') => {
    const reachable = new Set<string>();
    const stack = [root];

    while (stack.length) {
        const current = stack.pop()!;
        if (!reachable.has(current)) {
            reachable.add(current);
            const neighbors = direction === 'upstream' ? graph.predecessors(current) : graph.successors(current);
            if (neighbors) {
                for (const neighbor of neighbors) {
                    stack.push(neighbor);
                }
            }
        }
    }

    return reachable;
};

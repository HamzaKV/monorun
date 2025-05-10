import * as graphlib from 'graphlib';
import type { WorkspacePackage } from './workspace';
import { resolveFilter, type FilterMode } from './resolve-filter';

export const buildDependencyGraph = (
    packages: Map<string, WorkspacePackage>,
    options?: {
        root: string;
        filter?: string[];
        filterMode?: FilterMode;
    }
) => {
    const graph = new graphlib.Graph({ directed: true });

    for (const [name] of packages) {
        graph.setNode(name, { name });
    }

    for (const [name, pkg] of packages) {
        for (const dep of pkg.dependencies) {
            if (packages.has(dep)) {
                graph.setEdge(name, dep);
            }
        }
    }

    if (!options?.filter) {
        return graph;
    }

    const selected = resolveFilter({
        filter: options.filter,
        graph,
        packages,
        root: options.root,
        mode: options.filterMode,
    });

    if (selected.size === 0) {
        throw new Error('No packages matched the filter. Please check your filter syntax.');
    }

    // Prune
    for (const node of graph.nodes()) {
        if (!selected.has(node)) {
            graph.removeNode(node);
            // packages.delete(node);
        }
    }

    return graph;
};

export const getTopologicalSort = (graph: graphlib.Graph) => {
    if (!graph.isDirected()) {
        throw new Error('Graph must be directed for topological sort.');
    }

    if (!graphlib.alg.isAcyclic(graph)) {
        throw new Error('Graph must be acyclic for topological sort.');
    }

    return graphlib.alg.topsort(graph);
};

export const printGraph = (graph: graphlib.Graph) => {
    console.log('Graph:');
    graph.nodes().forEach((node) => {
        const edges = graph.outEdges(node);
        console.log(`  ${node} -> ${edges ? edges.map((e) => e.w).join(', ') : '[]'}`);
    });
};

export const getRoots = (graph: graphlib.Graph) => {
    if (!graphlib.alg.isAcyclic(graph)) {
        console.warn("Graph contains cycles, may not have a clear root node");
    }

    const nodes = graph.nodes();

    // Find nodes with no incoming edges (potential roots)
    const rootNodes = nodes.filter(node => {
        const predecessors = graph.predecessors(node);
        return Array.isArray(predecessors) ? predecessors.length === 0 : false;
    });

    return rootNodes;
};

export const toDotFormat = (graph: graphlib.Graph) => {
    let dot = 'digraph G {\n';
    graph.nodes().forEach((node) => {
        dot += `  "${node}" [label="${node}"];\n`;
    });
    graph.edges().forEach((edge) => {
        dot += `  "${edge.v}" -> "${edge.w}";\n`;
    });
    dot += '}';
    return dot;
};

import { v4 as uuidv4 } from 'uuid';
import * as db from '../db.js';
import type { QuestNodeStatus, QuestNodeType } from '../db.js';

export interface QuestNode {
  id: string;
  diveId: string;
  parentNodeId: string | null;
  nodeType: QuestNodeType;
  title: string;
  description: string | null;
  status: QuestNodeStatus;
  sortOrder: number;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface QuestEdge {
  id: string;
  diveId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: string;
  label: string | null;
  createdAt: string;
}

export interface QuestBranch {
  id: string;
  diveId: string;
  forkNodeId: string;
  name: string;
  description: string | null;
  isSelected: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuestMapData {
  nodes: QuestNode[];
  edges: QuestEdge[];
  branches: QuestBranch[];
}

function mapDbNode(row: db.DbDiveMapNode): QuestNode {
  return {
    id: row.id,
    diveId: row.dive_id,
    parentNodeId: row.parent_node_id,
    nodeType: row.node_type as QuestNodeType,
    title: row.title,
    description: row.description,
    status: row.status as QuestNodeStatus,
    sortOrder: row.sort_order,
    metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapDbEdge(row: db.DbDiveMapEdge): QuestEdge {
  return {
    id: row.id,
    diveId: row.dive_id,
    fromNodeId: row.from_node_id,
    toNodeId: row.to_node_id,
    edgeType: row.edge_type,
    label: row.label,
    createdAt: row.created_at,
  };
}

function mapDbBranch(row: db.DbDiveBranch): QuestBranch {
  return {
    id: row.id,
    diveId: row.dive_id,
    forkNodeId: row.fork_node_id,
    name: row.name,
    description: row.description,
    isSelected: row.is_selected === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class QuestMapService {
  getByDiveId(diveId: string): QuestMapData {
    const nodes = db.getDiveMapNodesByDive(diveId).map(mapDbNode);
    const edges = db.getDiveMapEdgesByDive(diveId).map(mapDbEdge);
    const branches = db.getDiveBranchesByDive(diveId).map(mapDbBranch);
    return { nodes, edges, branches };
  }

  getNode(nodeId: string): QuestNode | null {
    const row = db.getDiveMapNode(nodeId);
    return row ? mapDbNode(row) : null;
  }

  createNode(params: {
    diveId: string;
    parentNodeId?: string | null;
    nodeType: QuestNodeType;
    title: string;
    description?: string;
    status?: QuestNodeStatus;
    sortOrder?: number;
    metadata?: Record<string, unknown>;
  }): QuestNode {
    const now = new Date().toISOString();
    const node: db.DbDiveMapNode = {
      id: uuidv4(),
      dive_id: params.diveId,
      parent_node_id: params.parentNodeId ?? null,
      node_type: params.nodeType,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? 'available',
      sort_order: params.sortOrder ?? 0,
      metadata_json: params.metadata ? JSON.stringify(params.metadata) : null,
      created_at: now,
      updated_at: now,
    };
    db.createDiveMapNode(node);
    return mapDbNode(node);
  }

  continueNode(nodeId: string): { node: QuestNode; unlocked: QuestNode[] } {
    const row = db.getDiveMapNode(nodeId);
    if (!row) throw new Error('Node not found');

    db.updateDiveMapNodeStatus(nodeId, 'completed');

    const children = db.getDiveMapNodesByDive(row.dive_id).filter(
      n => n.parent_node_id === nodeId && n.status === 'locked'
    );

    const unlocked: QuestNode[] = [];
    for (const child of children) {
      const hasLockedParents = db.getDiveMapNodesByDive(row.dive_id).some(
        n => n.id === child.parent_node_id && n.status !== 'completed'
      );
      if (!hasLockedParents) {
        db.updateDiveMapNodeStatus(child.id, 'available');
        unlocked.push(mapDbNode(child));
      }
    }

    const updated = db.getDiveMapNode(nodeId)!;
    return { node: mapDbNode(updated), unlocked };
  }

  forkNode(forkNodeId: string, branches: { name: string; description?: string }[]): QuestBranch[] {
    const node = db.getDiveMapNode(forkNodeId);
    if (!node) throw new Error('Node not found');

    db.updateDiveMapNodeStatus(forkNodeId, 'forked');

    const now = new Date().toISOString();
    const created: QuestBranch[] = [];

    for (const branch of branches) {
      const branchRow: db.DbDiveBranch = {
        id: uuidv4(),
        dive_id: node.dive_id,
        fork_node_id: forkNodeId,
        name: branch.name,
        description: branch.description ?? null,
        is_selected: 0,
        created_at: now,
        updated_at: now,
      };
      db.createDiveBranch(branchRow);
      created.push(mapDbBranch(branchRow));
    }

    return created;
  }

  updateNodeStatus(nodeId: string, status: QuestNodeStatus): QuestNode {
    const success = db.updateDiveMapNodeStatus(nodeId, status);
    if (!success) throw new Error('Node not found');
    const updated = db.getDiveMapNode(nodeId)!;
    return mapDbNode(updated);
  }

  selectBranch(branchId: string): QuestBranch {
    const success = db.selectDiveBranch(branchId);
    if (!success) throw new Error('Branch not found');

    const branchRow = db.getDiveBranchesByDive('').find(b => b.id === branchId);
    // Refetch properly
    const allBranches = db.prepare('SELECT * FROM dive_branches WHERE id = ?').get(branchId) as db.DbDiveBranch | undefined;
    if (!allBranches) throw new Error('Branch not found after select');

    const branches = db.getDiveBranchesByForkNode(allBranches.fork_node_id);
    for (const b of branches) {
      if (b.id !== branchId && b.is_selected === 1) {
        db.updateDiveMapNodeStatus(b.id, 'available');
      }
    }

    return mapDbBranch(allBranches);
  }

  getBranchesByForkNode(forkNodeId: string): QuestBranch[] {
    return db.getDiveBranchesByForkNode(forkNodeId).map(mapDbBranch);
  }
}

export const questMapService = new QuestMapService();

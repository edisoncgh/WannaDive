import { v4 as uuidv4 } from 'uuid';
import * as db from '../db.js';
import type { AgentRunStep, AgentRunStepType } from '../types/dive.js';

function mapDbToStep(row: db.DbAgentRunStep): AgentRunStep {
  return {
    id: row.id,
    dive_id: row.dive_id,
    task_id: row.task_id,
    step_type: row.step_type as AgentRunStepType,
    title: row.title,
    description: row.description,
    status: row.status as AgentRunStep['status'],
    payload_json: row.payload_json,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class MissionBoardService {
  addStep(params: {
    diveId: string;
    taskId: string;
    stepType: AgentRunStepType;
    title: string;
    description?: string;
    status?: AgentRunStep['status'];
    payload?: Record<string, unknown>;
  }): AgentRunStep {
    const now = new Date().toISOString();
    const step: db.DbAgentRunStep = {
      id: uuidv4(),
      dive_id: params.diveId,
      task_id: params.taskId,
      step_type: params.stepType,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? 'running',
      payload_json: params.payload ? JSON.stringify(params.payload) : null,
      created_at: now,
      updated_at: now,
    };
    db.createAgentRunStep(step);
    return mapDbToStep(step);
  }

  updateStepStatus(stepId: string, status: AgentRunStep['status'], description?: string): boolean {
    return db.updateAgentRunStepStatus(stepId, status, description);
  }

  getStepsByDiveId(diveId: string): AgentRunStep[] {
    return db.getAgentRunStepsByDive(diveId).map(mapDbToStep);
  }

  getStepsByTaskId(taskId: string): AgentRunStep[] {
    return db.getAgentRunStepsByTask(taskId).map(mapDbToStep);
  }
}

export const missionBoardService = new MissionBoardService();

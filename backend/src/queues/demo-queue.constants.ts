export const DEMO_QUEUE = 'demo';
export const UPPERCASE_TEXT_JOB = 'uppercase-text';

export interface UppercaseTextJobData {
  text: string;
}

export interface UppercaseTextJobResult {
  text: string;
}

export type DemoJobState = 'completed' | 'failed' | 'active' | 'waiting' | 'delayed' | 'unknown';

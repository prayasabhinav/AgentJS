/**
 * Small Language Model - drives agent decisions with a tiny LLM
 *
 * Implements MLBehaviorModel, so it can be handed to MLAgent.loadBehaviorModel()
 * like any TensorFlow.js model. Each decision is made in three steps:
 *   1. the agent state is described in a few coarse words ("energy: low")
 *   2. the language model picks one of a fixed list of named choices
 *   3. the chosen name is turned into a regular AgentAction
 *
 * Coarse descriptions mean many agents share the same prompt, so decisions are
 * cached by prompt text: a crowd of 500 agents typically needs only a handful
 * of model calls per step.
 */

import type { MLBehaviorModel, MLAgentState, AgentAction } from '../../src/ml/interfaces';

/**
 * Anything that can run a small language model. Implement either method:
 * rankChoices is preferred because the answer is always a valid choice,
 * which matters for models under ~1B parameters.
 */
export interface SmallLMBackend {
  /** Return one score per choice for the given prompt (higher = more likely) */
  rankChoices?(prompt: string, choices: string[]): Promise<number[]>;

  /** Return a free-form completion for the given prompt */
  generate?(prompt: string, maxNewTokens: number): Promise<string>;

  dispose?(): void;
}

/** A named option the language model can choose */
export interface LMChoice {
  /** Single lowercase word the model answers with */
  name: string;

  /** Short explanation shown to the model */
  description: string;

  /** Build the action to execute when this choice wins */
  toAction(state: MLAgentState): AgentAction;
}

export interface SmallLanguageModelConfig {
  /** Creates the backend when load(modelPath) is called */
  loadBackend: (modelPath: string) => Promise<SmallLMBackend>;

  /** One sentence telling the model who the agent is */
  role: string;

  /** Options the model picks from (defaults to approach/avoid/explore/rest) */
  choices: LMChoice[];

  /** Turns agent state into situation lines; override for your domain */
  describeState: (state: MLAgentState) => string[];

  /** Movement per step for the default choices */
  stepSize: number;

  /** Maximum number of cached decisions */
  cacheSize: number;
}

/** Decision statistics, useful for comparing models */
export interface SmallLanguageModelStats {
  decisions: number;
  modelCalls: number;
  cacheHits: number;
  unparsedAnswers: number;
  totalModelTimeMs: number;
}

function neighborCentroid(state: MLAgentState): { x: number; y: number } | null {
  if (state.neighbors.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const neighbor of state.neighbors) {
    x += neighbor.position.x;
    y += neighbor.position.y;
  }
  return { x: x / state.neighbors.length, y: y / state.neighbors.length };
}

function moveRelativeToNeighbors(state: MLAgentState, stepSize: number, sign: 1 | -1): AgentAction {
  const centroid = neighborCentroid(state);
  let angle = Math.random() * Math.PI * 2;
  if (centroid) {
    angle = Math.atan2(centroid.y - state.position.y, centroid.x - state.position.x);
  }
  return {
    type: 'MOVE',
    parameters: {
      dx: Math.cos(angle) * stepSize * sign,
      dy: Math.sin(angle) * stepSize * sign
    }
  };
}

/** Default choices for a generic mobile agent with an energy property */
export function createDefaultChoices(stepSize: number): LMChoice[] {
  return [
    {
      name: 'approach',
      description: 'move toward nearby agents',
      toAction: state => moveRelativeToNeighbors(state, stepSize, 1)
    },
    {
      name: 'avoid',
      description: 'move away from nearby agents',
      toAction: state => moveRelativeToNeighbors(state, stepSize, -1)
    },
    {
      name: 'explore',
      description: 'wander to a new area',
      toAction: () => {
        const angle = Math.random() * Math.PI * 2;
        return { type: 'MOVE', parameters: { dx: Math.cos(angle) * stepSize, dy: Math.sin(angle) * stepSize } };
      }
    },
    {
      name: 'rest',
      description: 'stay still to recover energy',
      toAction: () => ({ type: 'CHANGE_PROPERTY', parameters: { property: 'energy', delta: 5 } })
    }
  ];
}

/** Default situation description: energy level and how crowded it is */
export function describeDefaultState(state: MLAgentState): string[] {
  const energy = state.properties['energy'] ?? 50;
  const energyLevel = energy < 30 ? 'low' : energy < 70 ? 'medium' : 'high';

  const count = state.neighbors.length;
  const crowding = count === 0 ? 'alone, no agents nearby' : count < 4 ? 'a few agents nearby' : 'crowded, many agents nearby';

  return [`energy: ${energyLevel}`, `surroundings: ${crowding}`];
}

export class SmallLanguageModel implements MLBehaviorModel {
  private backend: SmallLMBackend | undefined;
  private config: SmallLanguageModelConfig;
  private cache = new Map<string, { name: string; confidence: number }>();
  private stats: SmallLanguageModelStats = {
    decisions: 0,
    modelCalls: 0,
    cacheHits: 0,
    unparsedAnswers: 0,
    totalModelTimeMs: 0
  };

  constructor(config: Partial<SmallLanguageModelConfig> & Pick<SmallLanguageModelConfig, 'loadBackend'>) {
    const stepSize = config.stepSize ?? 5;
    this.config = {
      role: 'You are a small creature in a shared world. Stay alive and keep your energy up.',
      choices: createDefaultChoices(stepSize),
      describeState: describeDefaultState,
      stepSize,
      cacheSize: 256,
      ...config
    };
    if (this.config.choices.length === 0) {
      throw new Error('SmallLanguageModel needs at least one choice');
    }
  }

  async load(modelPath: string): Promise<void> {
    this.dispose();
    this.backend = await this.config.loadBackend(modelPath);
    if (!this.backend.rankChoices && !this.backend.generate) {
      throw new Error('SmallLMBackend must implement rankChoices or generate');
    }
  }

  /** Build the prompt sent to the model; identical situations give identical prompts */
  buildPrompt(state: MLAgentState): string {
    const situation = this.config.describeState(state).map(line => `- ${line}`);
    const options = this.config.choices.map(choice => `- ${choice.name}: ${choice.description}`);
    return [
      this.config.role,
      '',
      'Your situation:',
      ...situation,
      '',
      'Options:',
      ...options,
      '',
      'Which option is best right now? Answer with one word.'
    ].join('\n');
  }

  async predict(state: MLAgentState): Promise<AgentAction> {
    if (!this.backend) {
      throw new Error('SmallLanguageModel not loaded');
    }
    this.stats.decisions++;

    const prompt = this.buildPrompt(state);
    let decision = this.cache.get(prompt);

    if (decision === undefined) {
      const startTime = performance.now();
      decision = await this.decide(this.backend, prompt);
      this.stats.modelCalls++;
      this.stats.totalModelTimeMs += performance.now() - startTime;
      this.remember(prompt, decision);
    } else {
      this.stats.cacheHits++;
    }

    const choiceName = decision.name;
    const choice = this.config.choices.find(c => c.name === choiceName) ?? this.config.choices[0]!;
    return { ...choice.toAction(state), confidence: decision.confidence };
  }

  private async decide(backend: SmallLMBackend, prompt: string): Promise<{ name: string; confidence: number }> {
    const names = this.config.choices.map(choice => choice.name);

    if (backend.rankChoices) {
      const scores = await backend.rankChoices(prompt, names);
      // Softmax over the choices gives a confidence for the winner
      const max = Math.max(...scores);
      const weights = scores.map(score => Math.exp(score - max));
      const total = weights.reduce((sum, w) => sum + w, 0);
      const best = scores.indexOf(max);
      return { name: names[best]!, confidence: weights[best]! / total };
    }

    const answer = (await backend.generate!(prompt, 8)).toLowerCase();
    const matches = names
      .map(name => ({ name, index: answer.search(new RegExp(`\\b${name}\\b`)) }))
      .filter(match => match.index >= 0)
      .sort((a, b) => a.index - b.index);
    if (matches.length === 0) {
      this.stats.unparsedAnswers++;
      return { name: names[0]!, confidence: 0 };
    }
    return { name: matches[0]!.name, confidence: 0.5 };
  }

  private remember(prompt: string, decision: { name: string; confidence: number }): void {
    if (this.cache.size >= this.config.cacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(prompt, decision);
  }

  getStats(): SmallLanguageModelStats {
    return { ...this.stats };
  }

  clearCache(): void {
    this.cache.clear();
  }

  getRequiredInputs(): string[] {
    return ['energy'];
  }

  getOutputActions(): string[] {
    return this.config.choices.map(choice => choice.name);
  }

  dispose(): void {
    this.backend?.dispose?.();
    this.backend = undefined;
    this.cache.clear();
  }
}

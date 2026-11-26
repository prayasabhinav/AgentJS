/**
 * NSMnum, Narrow Small Model (numerating), said en-ess-em-num; one NSMnum, three NSMnum.
 *
 * An NSMnum answers only with a number: the place of an item in a list written in advance, or none. It never writes and it never
 * decides. Here each agent type gets its own NSMnum through a table written in code (NSMnumTable): the model chooses a place in
 * that type's list of actions, and code checks the answer before anything happens. Any answer that is not a whole number in the
 * list, that the type's own rule refuses, or that comes from a model that failed, is none, and none runs the type's stated
 * "don't know" action. The right answers an NSMnum learns from are a person's keys, given on a blind sheet (keyingItems,
 * readKeys, keyedRows), never the model's own choices or the simulation's outcomes. The table can be written in JSON, beside
 * the idea and the agents in a simulation's file (tableFromJSON): rows then match agents by their `kind` property.
 * The method: https://github.com/koherarchitecture/ungli
 */
import * as tf from '@tensorflow/tfjs';
import type { MLBehaviorModel, MLAgentState, AgentAction } from './interfaces';
import { MLAgent } from './MLAgent';

/** A small model that chooses: the place of one item in its row's list of actions, or null for none. */
export interface NSMnumModel {
  choose(state: MLAgentState): Promise<number | null>;
  dispose(): void;
}

/** One row of the table code routes by: which agents, which NSMnum, and what each answer means. */
export interface NSMnumRow {
  /** Agents of this class (or a subclass). The first row an agent matches is its row, so put narrower rows first. */
  agentType?: new (...args: any[]) => MLAgent;
  /** Or agents whose `kind` property is this name, as rows written in JSON say (see tableFromJSON). */
  kind?: string;
  model: NSMnumModel;
  /** Written in advance; the model answers with a place in this list. */
  actions: AgentAction[];
  /** What code does when the answer is none. */
  none: AgentAction;
  /** Code's own check before an answer is acted on; an answer it refuses is none. */
  allowed?: (state: MLAgentState, place: number) => boolean;
}

/** A row as an MLBehaviorModel, so an MLAgent can load it. */
export class NSMnumBehavior implements MLBehaviorModel {
  constructor(private row: NSMnumRow) {}

  async predict(state: MLAgentState): Promise<AgentAction> {
    let place: number | null = null;
    try {
      place = await this.row.model.choose(state);
    } catch {
      place = null;
    }
    const valid = place !== null && Number.isInteger(place) && place >= 0 && place < this.row.actions.length;
    const action = valid && (this.row.allowed?.(state, place!) ?? true) ? this.row.actions[place!] : undefined;
    return action ?? this.row.none;
  }

  async load(): Promise<void> {}

  getRequiredInputs(): string[] {
    return [];
  }

  getOutputActions(): string[] {
    return this.row.actions.map((a) => a.type);
  }

  /** The table owns the model, which several agents share, so an agent letting go of its row does not dispose it. */
  dispose(): void {}
}

/** The table, written in code, that gives each agent type its NSMnum. */
export class NSMnumTable {
  constructor(private rows: NSMnumRow[]) {}

  /** Gives each agent its row's NSMnum and "don't know" action. Returns the agents no row covers, for the caller to see. */
  async assign(agents: MLAgent[]): Promise<MLAgent[]> {
    const uncovered: MLAgent[] = [];
    for (const agent of agents) {
      const row = this.rows.find(
        (r) => (r.agentType !== undefined && agent instanceof r.agentType) || (r.kind !== undefined && agent.getProperty('kind') === r.kind)
      );
      if (!row) {
        uncovered.push(agent);
        continue;
      }
      await agent.loadBehaviorModel(new NSMnumBehavior(row));
      agent.setFallbackAction(row.none);
    }
    return uncovered;
  }

  dispose(): void {
    for (const row of this.rows) row.model.dispose();
  }
}

/**
 * An NSMnum on a small TensorFlow.js model with one output for each action and a last one for none. `encode` is code
 * written in advance that turns a state into the numbers the model reads. An answer whose share is below `threshold`
 * (set by measuring on keyed cases kept out of training) is none.
 */
export class TensorFlowChooser implements NSMnumModel {
  constructor(
    public model: tf.LayersModel,
    private encode: (state: MLAgentState) => number[],
    private threshold = 0
  ) {}

  /** A small model for `inputs` numbers and `actions` actions (plus none). */
  static create(inputs: number, actions: number): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [inputs], units: 16, activation: 'relu' }),
        tf.layers.dense({ units: actions + 1, activation: 'softmax' }),
      ],
    });
    model.compile({ optimizer: 'adam', loss: 'categoricalCrossentropy', metrics: ['accuracy'] });
    return model;
  }

  async choose(state: MLAgentState): Promise<number | null> {
    const output = tf.tidy(() => this.model.predict(tf.tensor2d([this.encode(state)])) as tf.Tensor);
    const shares = Array.from(await output.data());
    output.dispose();
    const top = Math.max(...shares);
    const best = shares.indexOf(top);
    return best === shares.length - 1 || top < this.threshold ? null : best;
  }

  /** Trains only on keyed rows; a row keyed none teaches the last output. */
  async train(rows: KeyedRow[], actions: number, epochs = 50): Promise<tf.History> {
    const xs = tf.tensor2d(rows.map((r) => r.features));
    const ys = tf.oneHot(tf.tensor1d(rows.map((r) => (r.place === null ? actions : r.place)), 'int32'), actions + 1);
    const history = await this.model.fit(xs, ys, { epochs, shuffle: true, verbose: 0 });
    xs.dispose();
    ys.dispose();
    return history;
  }

  dispose(): void {
    this.model.dispose();
  }
}

/** A situation from a run, kept so a person can key it. */
export interface Situation {
  id: string;
  state: MLAgentState;
}

/** One numbered situation for a blind sheet: the state as plain numbers and the list to choose from, with no model's answer on it. */
export interface KeyingItem {
  id: string;
  text: string;
  /** How many actions the list has, so a keyer can refuse a key outside it. */
  actions: number;
}

/** A situation with the person's key: the place they chose, or null for none. */
export interface KeyedRow {
  id: string;
  features: number[];
  place: number | null;
}

/**
 * Items for a blind sheet: save them as a JSON list and key them with `npx agentjs-key sheet.json my.keys.jsonl`, or with any
 * keyer that shows `text` and writes keys as JSON lines. Each lists the situation's numbers and the actions numbered from 1,
 * with 0 for none. Nothing a model chose is shown. Whoever uses the package keys their own; it ships no keys.
 */
/** What MLAgent records about its own model; a blind sheet never shows it. */
const BOOKKEEPING = new Set(['mlEnabled', 'predictionConfidence', 'fallbackMode', 'errorRate']);

export function keyingItems(situations: Situation[], actions: string[]): KeyingItem[] {
  return situations.map(({ id, state }) => ({
    id,
    actions: actions.length,
    text: [
      `position ${state.position.x.toFixed(1)}, ${state.position.y.toFixed(1)}`,
      ...Object.entries(state.properties)
        .filter(([k]) => !BOOKKEEPING.has(k))
        .map(([k, v]) => `${k} ${v}`),
      `neighbours ${state.neighbors.length}`,
      '',
      ...actions.map((a, i) => `${i + 1} ${a}`),
      '0 none',
    ].join('\n'),
  }));
}

/**
 * Reads keys written one JSON line each, `{"item": {"id": ...}, "key": ...}`, the latest key for an item winning.
 * A key of 1 to n is that action's place; 0 or "none" is none. Any other key is left out and its id returned in `unread`.
 */
export function readKeys(lines: string, actions: number): { keys: Map<string, number | null>; unread: string[] } {
  const keys = new Map<string, number | null>();
  const unread: string[] = [];
  for (const line of lines.split('\n')) {
    if (!line.trim()) continue;
    const { item, key } = JSON.parse(line);
    const n = key === 'none' ? 0 : Number(key);
    if (Number.isInteger(n) && n >= 0 && n <= actions) keys.set(item.id, n === 0 ? null : n - 1);
    else unread.push(item.id);
  }
  return { keys, unread };
}

/** The keyed situations as training rows; situations without a key are left out. */
export function keyedRows(
  situations: Situation[],
  keys: Map<string, number | null>,
  encode: (state: MLAgentState) => number[]
): KeyedRow[] {
  return situations.filter((s) => keys.has(s.id)).map((s) => ({ id: s.id, features: encode(s.state), place: keys.get(s.id)! }));
}

/**
 * A row as written in JSON, beside the idea and the agents in a simulation's file: the agents' `kind`, the NSMnum's model file
 * (a TensorFlow.js model.json), the numeric properties it reads, in order, the actions written in advance, the "don't know"
 * action, and optionally the threshold below which an answer is none.
 */
export interface NSMnumRowJSON {
  kind: string;
  model: string;
  reads: string[];
  actions: AgentAction[];
  none: AgentAction;
  threshold?: number;
}

const ACTION_TYPES = ['MOVE', 'INTERACT', 'CHANGE_PROPERTY', 'CUSTOM'];

/**
 * Builds the table from rows written in JSON. Every row is checked before anything loads, and each model is checked against
 * its row: it must read as many numbers as the row names and answer with one output per action plus one for none. A row
 * that fails either check stops the build with an error that names it. `load` reads a model file (the default fetches it,
 * as a browser does; in Node pass a loader that reads the file).
 */
export async function tableFromJSON(
  rows: NSMnumRowJSON[],
  load: (path: string) => Promise<tf.LayersModel> = (path) => tf.loadLayersModel(path)
): Promise<NSMnumTable> {
  const action = (a: AgentAction, where: string) => {
    if (!a || !ACTION_TYPES.includes(a.type) || typeof a.parameters !== 'object' || a.parameters === null) {
      throw new Error(`${where}: an action needs a type (${ACTION_TYPES.join(', ')}) and parameters`);
    }
  };
  if (!Array.isArray(rows) || rows.length === 0) throw new Error('nsmnum: no rows');
  rows.forEach((r, i) => {
    const where = `nsmnum row ${i + 1}${r && typeof r.kind === 'string' ? ` (${r.kind})` : ''}`;
    if (typeof r.kind !== 'string' || r.kind === '') throw new Error(`${where}: kind must be a name`);
    if (typeof r.model !== 'string' || r.model === '') throw new Error(`${where}: model must be a file`);
    if (!Array.isArray(r.reads) || r.reads.length === 0 || !r.reads.every((n) => typeof n === 'string' && n !== '')) {
      throw new Error(`${where}: reads must list the properties the model reads`);
    }
    if (!Array.isArray(r.actions) || r.actions.length === 0) throw new Error(`${where}: actions must list at least one action`);
    r.actions.forEach((a) => action(a, where));
    action(r.none, `${where}, none`);
    if (r.threshold !== undefined && !(typeof r.threshold === 'number' && r.threshold >= 0 && r.threshold <= 1)) {
      throw new Error(`${where}: threshold must be a number from 0 to 1`);
    }
  });
  if (new Set(rows.map((r) => r.kind)).size !== rows.length) throw new Error('nsmnum: two rows name the same kind');

  const table: NSMnumRow[] = [];
  for (const r of rows) {
    const model = await load(r.model);
    const inputs = model.inputs[0]?.shape[1], outputs = model.outputs[0]?.shape[1];
    if (inputs !== r.reads.length || outputs !== r.actions.length + 1) {
      model.dispose();
      throw new Error(
        `nsmnum row ${r.kind}: ${r.model} reads ${inputs} numbers and gives ${outputs} outputs; the row needs ${r.reads.length} and ${r.actions.length + 1}`
      );
    }
    // a property the agent lacks, or one that is not a number, makes choose() fail, and a failed answer is none
    const encode = (state: MLAgentState) =>
      r.reads.map((name) => {
        const value = state.properties[name];
        if (typeof value !== 'number') throw new Error(`${r.kind}: no number for ${name}`);
        return value;
      });
    table.push({ kind: r.kind, model: new TensorFlowChooser(model, encode, r.threshold ?? 0), actions: r.actions, none: r.none });
  }
  return new NSMnumTable(table);
}

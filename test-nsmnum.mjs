#!/usr/bin/env node
/**
 * Tests the NSMnum layer (src/ml/NSMnum.ts) against the built package: an answer acts only when it is a whole number in its
 * row's list and the row's rule allows it; every other answer, and a model that fails, runs the row's "don't know" action;
 * each agent type gets its own NSMnum from the table; keys read back from a blind sheet are the only training rows.
 */
import { MLAgent, NSMnumBehavior, NSMnumTable, TensorFlowChooser, keyingItems, readKeys, keyedRows, tableFromJSON } from './dist/index.es.js';
import * as tf from '@tensorflow/tfjs';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let passed = 0, total = 0;
const check = (name, ok) => { total++; if (ok) passed++; console.log(`${ok ? '✅' : '❌'} ${name}`); };

const actions = [
  { type: 'MOVE', parameters: { dx: 1, dy: 0 } },
  { type: 'MOVE', parameters: { dx: -1, dy: 0 } },
  { type: 'CHANGE_PROPERTY', parameters: { property: 'energy', value: 1 } },
];
const none = { type: 'CHANGE_PROPERTY', parameters: { property: 'waited', value: 1 } };
const answering = (answer) => ({ choose: async () => (typeof answer === 'function' ? answer() : answer), dispose() {} });
const state = { position: { x: 5, y: 5 }, properties: { energy: 3 }, environment: {}, neighbors: [] };
const act = (answer, allowed) => new NSMnumBehavior({ agentType: MLAgent, model: answering(answer), actions, none, ...(allowed && { allowed }) }).predict(state);

check('a place in the list acts', (await act(1)) === actions[1]);
check('none runs "don\'t know"', (await act(null)) === none);
check('a place past the end is none', (await act(3)) === none);
check('a negative place is none', (await act(-1)) === none);
check('a fraction is none', (await act(0.5)) === none);
check('a model that throws is none', (await act(() => { throw new Error('down'); })) === none);
check('a place the row refuses is none', (await act(2, (_s, place) => place !== 2)) === none);
check('a place the row allows acts', (await act(0, (_s, place) => place !== 2)) === actions[0]);

class Reader extends MLAgent {}
class Walker extends MLAgent {}
class Stranger extends MLAgent {}
const table = new NSMnumTable([
  { agentType: Reader, model: answering(0), actions, none },
  { agentType: Walker, model: answering(null), actions, none },
]);
const agents = [new Reader(), new Walker(), new Stranger()];
const uncovered = await table.assign(agents);
check('the table leaves out only the agent no row covers', uncovered.length === 1 && uncovered[0] === agents[2]);
const chosen = async (agent) => { let a; agent.once('mlPrediction', (e) => { a = e.action; }); agent.once('fallbackUsed', (e) => { a = e.action; }); await agent.step(); return a; };
check('each agent type gets its own NSMnum', (await chosen(agents[0])) === actions[0] && (await chosen(agents[1])) === none);
let seen;
agents[1].on('fallbackUsed', (e) => { seen = e.action; });
agents[1].removeBehaviorModel();
await agents[1].step();
check('with no model answer, an agent runs its row\'s "don\'t know", not a random step', seen === none);

const mover = new MLAgent(undefined, { kind: 'literal', distance: 0.2, concreteness: 0.8 });
const start = mover.position.x;
await new NSMnumTable([{ kind: 'literal', model: answering(0), actions, none }]).assign([mover]);
await mover.step();
check('a MOVE answer moves the agent itself, not only its x and y properties', mover.position.x === start + 1);
const bookkept = keyingItems([{ id: 'b', state: mover.getCurrentState() }], ['east', 'west', 'rest'])[0].text;
check('the blind sheet leaves out what the agent records about its model', !/mlEnabled|predictionConfidence|fallbackMode|errorRate/.test(bookkept) && bookkept.includes('distance 0.2'));

const situations = [1, 2, 3, 4, 5, 6].map((n) => ({ id: `s${n}`, state: { ...state, properties: { energy: n } } }));
const items = keyingItems(situations, ['east', 'west', 'rest']);
check('the blind sheet numbers the actions and shows no model answer', items[0].text.includes('1 east') && items[0].text.includes('0 none') && items[0].actions === 3 && !/confidence|predict/i.test(items[0].text));
const lines = [
  { item: { id: 's1' }, key: 1 }, { item: { id: 's2' }, key: '3' }, { item: { id: 's3' }, key: 'none' },
  { item: { id: 's4' }, key: 9 }, { item: { id: 's1' }, key: 2 },
].map((l) => JSON.stringify(l)).join('\n');
const { keys, unread } = readKeys(lines, 3);
check('the latest key for an item wins', keys.get('s1') === 1);
check('keys read as places, and 0 or "none" as none', keys.get('s2') === 2 && keys.get('s3') === null);
check('a key outside the list is left unread, never guessed', !keys.has('s4') && unread.includes('s4'));
const encode = (s) => [s.properties.energy / 6];
const rows = keyedRows(situations, keys, encode);
check('only keyed situations become training rows', rows.length === 3 && rows.every((r) => keys.has(r.id)));

// anyone who downloads the package keys their own: the terminal keyer, with keys piped in as a person would type them
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agentjs-key-'));
const sheet = path.join(dir, 'sheet.json'), keysFile = path.join(dir, 'my.keys.jsonl');
fs.writeFileSync(sheet, JSON.stringify(items.slice(0, 3)));
const key = (input) => spawnSync(process.execPath, ['bin/agentjs-key.mjs', sheet, keysFile], { input, encoding: 'utf8' });
key('9\n2\ns\n0\n');
const first = readKeys(fs.readFileSync(keysFile, 'utf8'), 3);
check('the keyer refuses a key outside the list, skips on s, and keeps the rest', first.keys.get('s1') === 1 && !first.keys.has('s2') && first.keys.get('s3') === null);
key('1\n');
const second = readKeys(fs.readFileSync(keysFile, 'utf8'), 3);
check('run again, the keyer starts at the first situation not yet keyed', second.keys.get('s2') === 0 && second.keys.size === 3 && fs.readFileSync(keysFile, 'utf8').trim().split('\n').length === 3);
fs.rmSync(dir, { recursive: true });

const chooser = new TensorFlowChooser(TensorFlowChooser.create(1, 3), encode, 0);
await chooser.train(rows, 3, 200);
const answer = await chooser.choose(situations[0].state);
check('a trained chooser answers with a place or none', answer === null || (Number.isInteger(answer) && answer >= 0 && answer < 3));
const strict = new TensorFlowChooser(chooser.model, encode, 1.01);
check('below its threshold a chooser answers none', (await strict.choose(situations[0].state)) === null);
chooser.dispose();

// the table written in JSON: rows match agents by kind, each model checked against its row
const saved = {};
const keep = (name, model) => model.save(tf.io.withSaveHandler(async (a) => { saved[name] = a; return { modelArtifactsInfo: { dateSaved: new Date(), modelTopologyType: 'JSON' } }; }));
await keep('literal.json', TensorFlowChooser.create(2, 2));
await keep('figurative.json', TensorFlowChooser.create(2, 2));
await keep('wide.json', TensorFlowChooser.create(3, 2));
const load = async (p) => tf.loadLayersModel(tf.io.fromMemory(saved[p]));
const step = (n) => ({ type: 'MOVE', parameters: { dx: n, dy: 0 } });
const hold = { type: 'CHANGE_PROPERTY', parameters: { property: 'held', value: 1 } };
const file = JSON.stringify({ nsmnum: [
  { kind: 'literal', model: 'literal.json', reads: ['distance', 'concreteness'], actions: [step(1), step(-1)], none: hold },
  { kind: 'figurative', model: 'figurative.json', reads: ['distance', 'concreteness'], actions: [step(2), step(-2)], none: hold, threshold: 0.99 },
] });
const fromFile = await tableFromJSON(JSON.parse(file).nsmnum, load);
const lit = new MLAgent(undefined, { kind: 'literal', distance: 0.2, concreteness: 0.8 });
const fig = new MLAgent(undefined, { kind: 'figurative', distance: 0.7, concreteness: 0.1 });
const thin = new MLAgent(undefined, { kind: 'literal', distance: 0.2 });
const other = new MLAgent(undefined, { kind: 'stranger', distance: 0.5, concreteness: 0.5 });
const left = await fromFile.assign([lit, fig, thin, other]);
check('rows written in JSON match agents by kind', left.length === 1 && left[0] === other);
const litAction = await chosen(lit);
check('an agent acts only from its own row\'s list, or its none', [step(1), step(-1), hold].some((a) => JSON.stringify(a) === JSON.stringify(litAction)));
check('a row\'s threshold from JSON turns a weak answer into none', JSON.stringify(await chosen(fig)) === JSON.stringify(hold));
check('an agent missing a property its row reads gets none', JSON.stringify(await chosen(thin)) === JSON.stringify(hold));
const refuses = async (rows, words) => { try { await tableFromJSON(rows, load); return false; } catch (e) { return e.message.includes(words); } };
const good = JSON.parse(file).nsmnum[0];
check('a row with an action of no known type is refused, by name', await refuses([{ ...good, actions: [{ type: 'FLY', parameters: {} }] }], 'literal'));
check('two rows of one kind are refused', await refuses([good, good], 'same kind'));
check('a model that reads more numbers than its row names is refused', await refuses([{ ...good, model: 'wide.json' }], 'reads 3 numbers'));
check('a row with no reads is refused', await refuses([{ ...good, reads: [] }], 'reads must list'));
fromFile.dispose();

console.log(`\n${passed}/${total} passed`);
process.exit(passed === total ? 0 : 1);

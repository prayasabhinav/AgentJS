#!/usr/bin/env node
/**
 * Key a blind sheet in the terminal: npx agentjs-key <sheet.json> <my.keys.jsonl>
 *
 * The sheet is the list keyingItems() made. Each situation is shown with its actions numbered from 1; type the number of
 * the action you would choose, 0 for none, s to skip, q to stop. Each key is added to the keys file as one JSON line
 * ({"item": {"id"}, "key", "date", "via"}), so stopping loses nothing: run it again and it shows only the situations
 * not yet keyed, skipped ones included. Your keys are yours: they stay in the file you name and are sent nowhere. Read them back with readKeys().
 */
import fs from 'node:fs';
import readline from 'node:readline';

const [sheetPath, keysPath] = process.argv.slice(2);
if (!sheetPath || !keysPath) {
  console.error('usage: agentjs-key <sheet.json> <my.keys.jsonl>');
  process.exit(2);
}
const items = JSON.parse(fs.readFileSync(sheetPath, 'utf8'));
const keyed = new Set(
  fs.existsSync(keysPath)
    ? fs.readFileSync(keysPath, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l).item.id)
    : []
);
const left = items.filter((item) => !keyed.has(item.id));
console.log(`${items.length} situations, ${items.length - left.length} keyed already, ${left.length} to key. 0 is none, s skips, q stops.\n`);

const rl = readline.createInterface({ input: process.stdin });
const lines = rl[Symbol.asyncIterator]();   // keeps every line, typed or piped, until it is asked for
const ask = async () => {
  process.stdout.write('> ');
  const next = await lines.next();
  return next.done ? 'q' : next.value.trim();   // the end of the input stops keying
};
let added = 0;
keying: for (const [i, item] of left.entries()) {
  console.log(`— ${i + 1} of ${left.length} —\n${item.text}\n`);
  for (;;) {
    const answer = await ask();
    if (answer === 'q') break keying;
    if (answer === 's') break;
    const n = Number(answer);
    if (answer !== '' && Number.isInteger(n) && n >= 0 && n <= item.actions) {
      fs.appendFileSync(keysPath, JSON.stringify({ item: { id: item.id }, key: n, date: new Date().toISOString(), via: 'agentjs-key' }) + '\n');
      added++;
      break;
    }
    console.log(`type a number from 0 to ${item.actions}, s or q`);
  }
  console.log('');
}
rl.close();
console.log(`${added} keys added to ${keysPath}.`);

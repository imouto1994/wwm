#!/usr/bin/env node
// Converts EasyPoll dashboard vote tables (saved as HTML) into a JSON array of
// { discordId, username, vote } entries for the PvP tracker.
//
// Usage:
//   pnpm easypoll:json group-4.html -o group-4.json
//   pnpm easypoll:json page-1.html page-2.html > group-4.json
//
// Getting the HTML: open the poll's votes in the EasyPoll dashboard, open the
// browser console and run `copy(document.querySelector('table').outerHTML)`,
// then paste into a file. If the votes span several pages, save each page and
// pass all the files; votes are merged by Discord ID.
//
// Quicker: paste easypoll-devtools.js into that console instead; it produces
// the same JSON and copies it to the clipboard, no files needed.

import { readFile, writeFile } from 'node:fs/promises';
import { mergeVotes, parseEasyPollVotes, tallyVotes } from './parse-votes.mjs';

const USAGE = 'Usage: pnpm easypoll:json <table.html> [more.html ...] [-o votes.json]';

function parseArgs(argv) {
  const inputs = [];
  let output;
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '-h' || arg === '--help') return { help: true, inputs };
    if (arg === '-o' || arg === '--output') {
      output = argv[++index];
    } else {
      inputs.push(arg);
    }
  }
  return { help: false, inputs, output };
}

async function main() {
  const { help, inputs, output } = parseArgs(process.argv.slice(2));
  if (help || inputs.length === 0) {
    console.error(USAGE);
    process.exit(help ? 0 : 1);
  }

  const lists = [];
  for (const file of inputs) {
    const { votes, skipped } = parseEasyPollVotes(await readFile(file, 'utf8'));
    for (const row of skipped) console.error(`${file}: skipped row ${row.row} (${row.reason})`);
    lists.push(votes);
  }

  const { votes, conflicts } = mergeVotes(lists);
  for (const conflict of conflicts) {
    console.error(`Warning: ${conflict.username || conflict.discordId} has different answers (${conflict.votes.join(' vs ')}); kept the first.`);
  }
  if (votes.length === 0) {
    console.error('No votes found. Is this the votes table from the EasyPoll dashboard?');
    process.exit(1);
  }

  const json = `${JSON.stringify(votes, null, 2)}\n`;
  if (output) {
    await writeFile(output, json);
  } else {
    process.stdout.write(json);
  }

  const summary = tallyVotes(votes)
    .map(([vote, count]) => `${vote} ${count}`)
    .join(', ');
  console.error(`${votes.length} votes from ${inputs.length} file${inputs.length === 1 ? '' : 's'}: ${summary}${output ? ` (saved to ${output})` : ''}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

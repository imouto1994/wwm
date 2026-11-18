import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mergeVotes, parseEasyPollVotes, tallyVotes } from './parse-votes.mjs';

const fixture = await readFile(new URL('./fixtures/votes-table.html', import.meta.url), 'utf8');

test('reads the username and answer from each row, skipping the ID tooltip', () => {
  const { votes, skipped } = parseEasyPollVotes(fixture);
  assert.deepEqual(votes, [
    { username: 'player.one', vote: 'Lan' },
    { username: 'tom&jerry', vote: 'Minh' },
    { username: '10naichuoi9', vote: 'Tuấn' },
    { username: 'no_id_user', vote: 'Lan' },
  ]);
  assert.deepEqual(skipped, []);
});

test('reports rows without a username instead of guessing', () => {
  const table = `<table><thead><tr><th>Answer</th><th>User</th></tr></thead><tbody>
    <tr><td>Minh</td><td><div><img alt="User Avatar" src="x.png" /></div></td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEasyPollVotes(table), { votes: [], skipped: [{ row: 1, reason: 'no username' }] });
});

test('finds the votes table inside a larger page', () => {
  const page = `<html><body><table><tr><td>unrelated</td></tr></table>${fixture}</body></html>`;
  assert.equal(parseEasyPollVotes(page).votes.length, 4);
});

test('uses the header to locate columns, so reordered columns still parse', () => {
  const reordered = `<table><thead><tr><th>User</th><th>Answer</th></tr></thead><tbody>
    <tr><td><div><div>someone</div><div role="tooltip"><div>123456789012345678</div></div></div></td><td>Minh</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEasyPollVotes(reordered).votes, [{ username: 'someone', vote: 'Minh' }]);
});

test('returns nothing for input that is not a votes table', () => {
  assert.deepEqual(parseEasyPollVotes('<p>hello</p>'), { votes: [], skipped: [] });
});

test('merges pages by username and reports conflicting answers', () => {
  const pageOne = [
    { username: 'a', vote: 'Lan' },
    { username: 'b', vote: 'Minh' },
  ];
  const pageTwo = [
    { username: 'b', vote: 'Minh' },
    { username: 'c', vote: 'Tuấn' },
    { username: 'a', vote: 'Minh' },
  ];
  const { votes, conflicts } = mergeVotes([pageOne, pageTwo]);
  assert.deepEqual(
    votes.map((vote) => vote.username),
    ['a', 'b', 'c']
  );
  assert.equal(votes[0].vote, 'Lan');
  assert.deepEqual(conflicts, [{ username: 'a', votes: ['Lan', 'Minh'] }]);
});

test('tallies votes per answer, most first', () => {
  const votes = [{ vote: 'Minh' }, { vote: 'Lan' }, { vote: 'Minh' }];
  assert.deepEqual(tallyVotes(votes), [
    ['Minh', 2],
    ['Lan', 1],
  ]);
});

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { mergeVotes, parseEasyPollVotes, tallyVotes } from './parse-votes.mjs';

const fixture = await readFile(new URL('./fixtures/votes-table.html', import.meta.url), 'utf8');

test('reads Discord ID, username and answer from each row', () => {
  const { votes } = parseEasyPollVotes(fixture);
  assert.deepEqual(votes, [
    { discordId: '100000000000000001', username: 'player.one', vote: 'Lan' },
    { discordId: '100000000000000002', username: 'tom&jerry', vote: 'Minh' },
    { discordId: '100000000000000003', username: '10naichuoi9', vote: 'Tuấn' },
  ]);
});

test('falls back to the avatar URL when the tooltip is missing', () => {
  const { votes } = parseEasyPollVotes(fixture);
  assert.equal(votes[2].discordId, '100000000000000003');
});

test('reports rows without any Discord ID instead of guessing', () => {
  const { skipped } = parseEasyPollVotes(fixture);
  assert.deepEqual(skipped, [{ row: 4, reason: 'no Discord ID' }]);
});

test('finds the votes table inside a larger page', () => {
  const page = `<html><body><table><tr><td>unrelated</td></tr></table>${fixture}</body></html>`;
  assert.equal(parseEasyPollVotes(page).votes.length, 3);
});

test('uses the header to locate columns, so reordered columns still parse', () => {
  const reordered = `<table><thead><tr><th>User</th><th>Answer</th></tr></thead><tbody>
    <tr><td><div><div>someone</div><div role="tooltip"><div>123456789012345678</div></div></div></td><td>Minh</td></tr>
  </tbody></table>`;
  assert.deepEqual(parseEasyPollVotes(reordered).votes, [{ discordId: '123456789012345678', username: 'someone', vote: 'Minh' }]);
});

test('returns nothing for input that is not a votes table', () => {
  assert.deepEqual(parseEasyPollVotes('<p>hello</p>'), { votes: [], skipped: [] });
});

test('merges pages by Discord ID and reports conflicting answers', () => {
  const pageOne = [
    { discordId: '1', username: 'a', vote: 'Lan' },
    { discordId: '2', username: 'b', vote: 'Minh' },
  ];
  const pageTwo = [
    { discordId: '2', username: 'b', vote: 'Minh' },
    { discordId: '3', username: 'c', vote: 'Tuấn' },
    { discordId: '1', username: 'a', vote: 'Minh' },
  ];
  const { votes, conflicts } = mergeVotes([pageOne, pageTwo]);
  assert.deepEqual(
    votes.map((vote) => vote.discordId),
    ['1', '2', '3']
  );
  assert.equal(votes[0].vote, 'Lan');
  assert.deepEqual(conflicts, [{ discordId: '1', username: 'a', votes: ['Lan', 'Minh'] }]);
});

test('tallies votes per answer, most first', () => {
  const votes = [{ vote: 'Minh' }, { vote: 'Lan' }, { vote: 'Minh' }];
  assert.deepEqual(tallyVotes(votes), [
    ['Minh', 2],
    ['Lan', 1],
  ]);
});

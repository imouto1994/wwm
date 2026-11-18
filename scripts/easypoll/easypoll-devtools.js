// EasyPoll votes -> JSON for the PvP tracker's prediction import, straight from the browser.
//
// Open a poll's votes in the EasyPoll dashboard, open Chrome DevTools (Cmd+Option+J),
// paste this whole file into the Console and press Enter. It copies a JSON array of
// { username, vote } (Discord usernames) to the clipboard, the same format as
// `pnpm easypoll:json`, and prints a summary to check against the dashboard.
//
// Votes split over several pages: run it again on each page. Runs on the same
// poll page in this tab are merged by username, and the clipboard always holds
// everything collected so far. Reload the page to start over.
//
// Chrome may ask you to type "allow pasting" before the first paste. To reuse it,
// save it under Sources -> Snippets and run it with Cmd+Enter.
//
// The parsing rules mirror parse-votes.mjs (which reads saved HTML in Node);
// keep the two in sync.
(() => {
  // Strips a leading emoji from the answer label but keeps leading digits ("10naichuoi9").
  const LEADING_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3\s]+/u;

  // Visible text pieces of an element, one per text node, optionally skipping a descendant.
  function textPieces(root, exclude) {
    const pieces = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (exclude?.contains(node)) continue;
      const text = node.textContent.trim();
      if (text) pieces.push(text);
    }
    return pieces;
  }

  const headersOf = (table) => [...table.querySelectorAll('thead th')].map((cell) => cell.textContent.trim().toLowerCase());
  const table = [...document.querySelectorAll('table')].find((candidate) => {
    const headers = headersOf(candidate);
    return headers.includes('answer') && headers.includes('user');
  });
  if (!table) {
    console.error('EasyPoll: no votes table on this page. Open the poll in the dashboard and show its votes first.');
    return;
  }
  const headers = headersOf(table);
  const answerColumn = headers.indexOf('answer');
  const userColumn = headers.indexOf('user');

  const pageVotes = [];
  const skipped = [];
  [...table.querySelectorAll('tbody tr')].forEach((row, index) => {
    const answerCell = row.cells[answerColumn];
    const userCell = row.cells[userColumn];
    if (!answerCell || !userCell) {
      skipped.push(`row ${index + 1}: not enough columns`);
      return;
    }

    const label = textPieces(answerCell).at(-1) ?? '';
    const vote = label.replace(LEADING_EMOJI, '') || label;

    // The username is the cell's visible text; its hover tooltip (the numeric ID) is skipped.
    const username = textPieces(userCell, userCell.querySelector('[role="tooltip"]'))[0] ?? '';

    if (!username) skipped.push(`row ${index + 1}: no username`);
    else if (!vote) skipped.push(`row ${index + 1} (${username}): no answer`);
    else pageVotes.push({ username, vote });
  });

  // Keyed by path so another poll opened in the same tab starts fresh. On the same
  // voter, this page wins: it is the newest read of the dashboard.
  const stash = (window.__easypollVotes ??= {});
  const collected = new Map((stash[location.pathname] ?? []).map((entry) => [entry.username, entry]));
  const changed = [];
  for (const entry of pageVotes) {
    const earlier = collected.get(entry.username);
    if (earlier && earlier.vote !== entry.vote) changed.push(`${entry.username}: ${earlier.vote} -> ${entry.vote}`);
    collected.set(entry.username, entry);
  }
  const votes = [...collected.values()];
  stash[location.pathname] = votes;

  for (const reason of skipped) console.warn(`EasyPoll: skipped ${reason}`);
  for (const change of changed) console.warn(`EasyPoll: answer changed since the last run, kept the newest: ${change}`);
  if (votes.length === 0) {
    console.error('EasyPoll: no votes found in the table.');
    return;
  }

  const counts = new Map();
  for (const { vote } of votes) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  const summary = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([vote, count]) => `${vote} ${count}`)
    .join(', ');
  const plural = (count) => `${count} ${count === 1 ? 'vote' : 'votes'}`;
  const scope = votes.length === pageVotes.length ? plural(votes.length) : `${plural(pageVotes.length)} on this page, ${votes.length} collected for this poll`;
  const json = JSON.stringify(votes, null, 2);

  console.table(votes.map(({ username, vote }) => ({ username, vote })));
  // `copy` is the DevTools console helper; navigator.clipboard fails while the console has focus.
  if (typeof copy === 'function') {
    copy(json);
    console.log(`EasyPoll: ${scope} copied as JSON (${summary}). Paste it into the PvP host page's poll import.`);
  } else {
    console.log(`EasyPoll: ${scope} (${summary}). Copy the JSON below into the PvP host page's poll import:\n${json}`);
  }
})();

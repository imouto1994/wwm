// Turns the votes table from the EasyPoll dashboard into a list of
// { discordId, username, vote } entries for the PvP tracker's predictions.
//
// The dashboard has no export button, so this reads the rendered table HTML
// copied from the browser. It is regex-based on purpose, so it runs in Node and
// in a browser without a DOM library. That works because EasyPoll's markup is
// generated and regular: table cells are never nested, the header row names the
// "Answer" and "User" columns, and the voter's Discord ID only appears in the
// hover tooltip of the User cell.
//
// easypoll-devtools.js applies the same rules to the live page with DOM APIs;
// keep the two in sync.

const DISCORD_ID = /^\d{17,20}$/;

// Answers can start with an emoji (EasyPoll renders it as its own text node, but
// typed-in emoji end up in the label). Digits are deliberately not matched, so
// labels like "10naichuoi9" stay intact.
const LEADING_EMOJI = /^[\p{Extended_Pictographic}\p{Emoji_Modifier}\p{Regional_Indicator}\u200d\ufe0f\u20e3\s]+/u;

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const code = entity[1].toLowerCase() === 'x' ? Number.parseInt(entity.slice(2), 16) : Number.parseInt(entity.slice(1), 10);
      return Number.isInteger(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Visible text of an HTML fragment, split wherever a tag or comment sat.
function textPieces(fragment) {
  return fragment
    .replace(/<!--[\s\S]*?-->/g, '\n')
    .replace(/<[^>]*>/g, '\n')
    .split('\n')
    .map((piece) => decodeEntities(piece).trim())
    .filter(Boolean);
}

function innerHtmlOf(html, tag) {
  const pattern = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  return [...html.matchAll(pattern)].map((match) => match[1]);
}

// The input may be just the table, or a whole saved page with other tables.
function findVotesTable(html) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  return tables.find((table) => /\bAnswer\b/.test(table) && /\bUser\b/.test(table)) ?? tables[0] ?? html;
}

function columnIndex(headers, name, fallback) {
  const index = headers.findIndex((header) => header.toLowerCase() === name);
  return index >= 0 ? index : fallback;
}

/**
 * Parses one EasyPoll votes table. Rows that can't be read are reported in
 * `skipped` (1-based row numbers) instead of failing the whole table.
 */
export function parseEasyPollVotes(html) {
  const table = findVotesTable(html);
  const thead = table.match(/<thead\b[\s\S]*?<\/thead>/i)?.[0] ?? '';
  const headers = innerHtmlOf(thead, 'th').map((cell) => textPieces(cell).join(' '));
  const answerColumn = columnIndex(headers, 'answer', 1);
  const userColumn = columnIndex(headers, 'user', 2);
  const body = table.match(/<tbody\b[\s\S]*?<\/tbody>/i)?.[0] ?? table.replace(/<thead\b[\s\S]*?<\/thead>/i, '');

  const votes = [];
  const skipped = [];
  innerHtmlOf(body, 'tr').forEach((row, index) => {
    const rowNumber = index + 1;
    const cells = innerHtmlOf(row, 'td');
    if (cells.length <= Math.max(answerColumn, userColumn)) {
      skipped.push({ row: rowNumber, reason: 'not enough columns' });
      return;
    }

    const label = textPieces(cells[answerColumn]).at(-1) ?? '';
    const vote = label.replace(LEADING_EMOJI, '') || label;

    const userCell = cells[userColumn];
    const tooltipStart = userCell.search(/<div\b[^>]*\brole="tooltip"/i);
    const visiblePart = tooltipStart >= 0 ? userCell.slice(0, tooltipStart) : userCell;
    const tooltipPieces = tooltipStart >= 0 ? textPieces(userCell.slice(tooltipStart)) : [];
    // Custom avatars also carry the ID in their URL; default avatars don't.
    const discordId = tooltipPieces.find((piece) => DISCORD_ID.test(piece)) ?? userCell.match(/\/avatars\/(\d{17,20})\//)?.[1];
    const username = textPieces(visiblePart)[0] ?? '';

    if (!discordId) {
      skipped.push({ row: rowNumber, reason: 'no Discord ID' });
      return;
    }
    if (!vote) {
      skipped.push({ row: rowNumber, reason: 'no answer' });
      return;
    }
    votes.push({ discordId, username, vote });
  });

  return { votes, skipped };
}

/**
 * Combines votes from several pages of the same poll, keeping one vote per
 * Discord ID. The same ID with a different answer is reported in `conflicts`
 * rather than silently resolved; the first answer is kept.
 */
export function mergeVotes(voteLists) {
  const byId = new Map();
  const conflicts = [];
  for (const vote of voteLists.flat()) {
    const existing = byId.get(vote.discordId);
    if (!existing) {
      byId.set(vote.discordId, vote);
    } else if (existing.vote !== vote.vote) {
      conflicts.push({ discordId: vote.discordId, username: vote.username, votes: [existing.vote, vote.vote] });
    }
  }
  return { votes: [...byId.values()], conflicts };
}

/** Vote counts per answer, most votes first. */
export function tallyVotes(votes) {
  const counts = new Map();
  for (const { vote } of votes) counts.set(vote, (counts.get(vote) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

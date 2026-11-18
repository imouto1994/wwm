import type {
  Game,
  GamesPick,
  GamesPoll,
  Placement,
  PlayerId,
  Poll,
  Result,
  SemifinalPicks,
  Series,
  SeriesStage,
  Stage,
  TieDraw,
  Tournament,
} from '../types/tournament.js';
import { isSupportedCount, isValidGamesLine } from './format.js';
import { MAX_DISPLAY_NAME, MAX_DISPLAY_NAMES, normalizeUsername } from './names.js';

// Turns untrusted JSON (a PUT body on the server, a GET response in the
// browser) into a Tournament, or explains what is wrong. It never throws and
// rebuilds every object field by field, so unknown keys are dropped and a
// malformed document can never be saved or rendered.

const STAGES: readonly Stage[] = ['setup', 'groups', 'semis', 'final', 'done'];
const SERIES_STAGES: readonly SeriesStage[] = ['group', 'semi', 'final'];

class Invalid extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Invalid(message);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const optionalString = (value: unknown) => value === undefined || isString(value);

const isDisplayName = (value: unknown): value is string => isString(value) && value.length > 0 && value.length <= MAX_DISPLAY_NAME;

// Only the shape is checked here. Username format and unique names are rules
// for new input (setDisplayNames, setPlayers), so documents converted from
// version 1, with ids like p1, still load.
function parseDisplayNames(value: unknown): Record<string, string> {
  check(isObject(value), 'displayNames must be an object.');
  const entries = Object.entries(value);
  check(entries.length <= MAX_DISPLAY_NAMES, `displayNames can list at most ${MAX_DISPLAY_NAMES} people.`);
  check(
    entries.every(([username, name]) => username && isDisplayName(name)),
    `displayNames must map usernames to names of 1 to ${MAX_DISPLAY_NAME} characters.`
  );
  return Object.fromEntries(entries) as Record<string, string>;
}

function parsePlayers(value: unknown): PlayerId[] {
  check(Array.isArray(value) && value.every((playerId) => isString(playerId) && playerId), 'players must be a list of usernames.');
  return value as PlayerId[];
}

/** Version 1 stored `{ id, name }` players with made-up ids (p1, p2, …); the names become display names under those ids. */
function parseVersion1Players(value: unknown): { players: PlayerId[]; displayNames: Record<string, string> } {
  check(Array.isArray(value), 'players must be a list.');
  const players = value.map((player, index) => {
    check(isObject(player) && isString(player.id) && player.id && isDisplayName(player.name), `players[${index}] must have an id and a name.`);
    return { id: player.id, name: player.name };
  });
  return { players: players.map((player) => player.id), displayNames: Object.fromEntries(players.map((player) => [player.id, player.name])) };
}

function parseGame(value: unknown, path: string, players: readonly PlayerId[]): Game {
  check(isObject(value) && Array.isArray(value.placement) && isString(value.savedAt), `${path} must have a placement and savedAt.`);
  const placement = value.placement;
  check(
    placement.length === 3 && new Set(placement).size === 3 && placement.every((playerId) => isString(playerId) && players.includes(playerId)),
    `${path}.placement must list the series' three players once each.`
  );
  return { placement: placement as Placement, savedAt: value.savedAt };
}

/**
 * Reads a poll's ballots, one per Discord member; `read` checks the pick.
 * Polls saved before the votes JSON was required may hold only counts and no
 * ballots. They can't feed the leaderboard, so they come back undefined and
 * are dropped; the host imports that poll's JSON again.
 */
function parseBallots<T>(
  value: Record<string, unknown>,
  path: string,
  read: (ballot: Record<string, unknown>) => T | undefined
): (T & { username: string })[] | undefined {
  if (value.ballots === undefined) return undefined;
  check(Array.isArray(value.ballots), `${path}.ballots must be a list.`);
  const ballots = value.ballots.map((ballot, index) => {
    check(isObject(ballot), `${path}.ballots[${index}] is invalid.`);
    // Version 1 ballots also carried a Discord ID, which stands in for a missing username.
    const username = isString(ballot.username) && ballot.username.trim() ? normalizeUsername(ballot.username) : ballot.discordId;
    check(isString(username) && username, `${path}.ballots[${index}] is invalid.`);
    const pick = read(ballot);
    check(pick !== undefined, `${path}.ballots[${index}] is invalid.`);
    return { username, ...pick };
  });
  check(new Set(ballots.map((ballot) => ballot.username)).size === ballots.length, `${path} has more than one ballot from the same member.`);
  return ballots.length > 0 ? ballots : undefined;
}

function parsePoll(value: unknown, path: string, players: readonly PlayerId[]): Poll | undefined {
  check(isObject(value) && isString(value.recordedAt), `${path} must have recordedAt.`);
  const ballots = parseBallots(value, path, (ballot) =>
    isString(ballot.playerId) && players.includes(ballot.playerId) ? { playerId: ballot.playerId } : undefined
  );
  return ballots && { ballots, recordedAt: value.recordedAt };
}

const GAMES_PICKS: readonly GamesPick[] = ['over', 'under'];

function parseGamesPoll(value: unknown, path: string): GamesPoll | undefined {
  check(isObject(value) && isValidGamesLine(value.line) && isString(value.recordedAt), `${path} must have a line and recordedAt.`);
  const ballots = parseBallots(value, path, (ballot) =>
    isString(ballot.pick) && (GAMES_PICKS as readonly string[]).includes(ballot.pick) ? { pick: ballot.pick as GamesPick } : undefined
  );
  return ballots && { line: value.line, ballots, recordedAt: value.recordedAt };
}

function parseSeries(value: unknown, path: string, knownPlayers: ReadonlySet<PlayerId>): Series {
  check(isObject(value), `${path} must be an object.`);
  check(isString(value.id) && value.id, `${path}.id is missing.`);
  check(isString(value.stage) && (SERIES_STAGES as readonly string[]).includes(value.stage), `${path}.stage is invalid.`);
  check(isString(value.label), `${path}.label is missing.`);
  check(value.winsNeeded === 1 || value.winsNeeded === 2 || value.winsNeeded === 3, `${path}.winsNeeded must be 1, 2 or 3.`);
  const winsNeeded = value.winsNeeded;
  check(Array.isArray(value.playerIds) && value.playerIds.length === 3, `${path}.playerIds must list three players.`);
  const playerIds = value.playerIds;
  check(
    new Set(playerIds).size === 3 && playerIds.every((playerId) => isString(playerId) && knownPlayers.has(playerId)),
    `${path}.playerIds must be three different known players.`
  );
  check(Array.isArray(value.games), `${path}.games must be a list.`);
  const games = value.games.map((game, index) => parseGame(game, `${path}.games[${index}]`, playerIds));

  // No game may follow the one that decided the series.
  const wins = new Map<string, number>();
  games.forEach((game, index) => {
    const winner = game.placement[0];
    const total = (wins.get(winner) ?? 0) + 1;
    wins.set(winner, total);
    check(total < winsNeeded || index === games.length - 1, `${path} has games after the series was decided.`);
  });

  check(optionalString(value.startedAt), `${path}.startedAt must be a string.`);
  let winnerOverride: Series['winnerOverride'];
  if (value.winnerOverride !== undefined) {
    const override = value.winnerOverride;
    check(
      isObject(override) && isString(override.playerId) && playerIds.includes(override.playerId) && isString(override.reason),
      `${path}.winnerOverride is invalid.`
    );
    winnerOverride = { playerId: override.playerId, reason: override.reason };
  }
  const poll = value.poll === undefined ? undefined : parsePoll(value.poll, `${path}.poll`, playerIds);
  // Documents from before the lines were fixed may still carry a `gamesLine`; like any unknown key, it's dropped.
  const gamesPoll = value.gamesPoll === undefined ? undefined : parseGamesPoll(value.gamesPoll, `${path}.gamesPoll`);

  return {
    id: value.id,
    stage: value.stage as SeriesStage,
    label: value.label,
    playerIds: playerIds as [PlayerId, PlayerId, PlayerId],
    winsNeeded,
    games,
    ...(isString(value.startedAt) ? { startedAt: value.startedAt } : {}),
    ...(winnerOverride ? { winnerOverride } : {}),
    ...(poll ? { poll } : {}),
    ...(gamesPoll ? { gamesPoll } : {}),
  };
}

function parseTieDraw(value: unknown, path: string, knownPlayers: ReadonlySet<PlayerId>): TieDraw {
  check(
    isObject(value) &&
      isString(value.key) &&
      isString(value.drawnAt) &&
      Array.isArray(value.order) &&
      value.order.every((playerId) => isString(playerId) && knownPlayers.has(playerId)),
    `${path} is invalid.`
  );
  return { key: value.key, order: value.order as PlayerId[], drawnAt: value.drawnAt };
}

// Only the shape is checked here: whether a pick still fits the results is
// derived (see semifinalSelection), because undoing a game can change it.
function parseSemifinalPicks(value: unknown, knownPlayers: ReadonlySet<PlayerId>): SemifinalPicks {
  check(isObject(value) && Array.isArray(value.fillIns) && Array.isArray(value.dropped), 'semifinalPicks must have fillIns and dropped lists.');
  const ids = (list: unknown[], name: string): PlayerId[] => {
    check(
      list.every((playerId) => isString(playerId) && knownPlayers.has(playerId)) && new Set(list).size === list.length,
      `semifinalPicks.${name} must list known players once each.`
    );
    return list as PlayerId[];
  };
  return { fillIns: ids(value.fillIns, 'fillIns'), dropped: ids(value.dropped, 'dropped') };
}

function parseSemifinalDraft(value: unknown, knownPlayers: ReadonlySet<PlayerId>): [PlayerId, PlayerId, PlayerId][] {
  check(
    Array.isArray(value) && value.length === 3 && value.every((group) => Array.isArray(group) && group.length === 3),
    'semifinalDraft must be three groups of three.'
  );
  const ids = (value as unknown[][]).flat();
  check(
    ids.every((playerId) => isString(playerId) && knownPlayers.has(playerId)) && new Set(ids).size === 9,
    'semifinalDraft must list nine different known players.'
  );
  return (value as PlayerId[][]).map((group) => [group[0], group[1], group[2]]);
}

export function parseTournament(input: unknown): Result<Tournament> {
  try {
    check(isObject(input), 'The tournament must be an object.');
    check(input.schemaVersion === 1 || input.schemaVersion === 2, 'Unknown schema version.');
    check(typeof input.version === 'number' && Number.isInteger(input.version) && input.version >= 0, 'version must be a whole number.');
    check(isString(input.updatedAt), 'updatedAt must be a string.');
    check(isString(input.name) && input.name.length <= 80, 'name must be a short string.');
    check(isString(input.stage) && (STAGES as readonly string[]).includes(input.stage), 'stage is invalid.');
    check(typeof input.lateRule === 'boolean', 'lateRule must be true or false.');

    const { players, displayNames } =
      input.schemaVersion === 1
        ? parseVersion1Players(input.players)
        : { players: parsePlayers(input.players), displayNames: parseDisplayNames(input.displayNames) };
    check(players.length === 0 || isSupportedCount(players.length), 'There must be 21, 24, 27 or 30 players.');
    const knownPlayers = new Set(players);
    check(knownPlayers.size === players.length, 'Player ids must be unique.');

    check(Array.isArray(input.series), 'series must be a list.');
    const series = input.series.map((entry, index) => parseSeries(entry, `series[${index}]`, knownPlayers));
    check(new Set(series.map((entry) => entry.id)).size === series.length, 'Series ids must be unique.');

    check(input.currentSeriesId === undefined || series.some((entry) => entry.id === input.currentSeriesId), 'currentSeriesId points to a missing series.');
    check(Array.isArray(input.tieDraws), 'tieDraws must be a list.');
    const tieDraws = input.tieDraws.map((draw, index) => parseTieDraw(draw, `tieDraws[${index}]`, knownPlayers));
    const semifinalPicks = input.semifinalPicks === undefined ? undefined : parseSemifinalPicks(input.semifinalPicks, knownPlayers);
    const semifinalDraft = input.semifinalDraft === undefined ? undefined : parseSemifinalDraft(input.semifinalDraft, knownPlayers);

    return {
      ok: true,
      value: {
        schemaVersion: 2,
        version: input.version,
        updatedAt: input.updatedAt,
        name: input.name,
        players,
        displayNames,
        stage: input.stage as Stage,
        series,
        ...(isString(input.currentSeriesId) ? { currentSeriesId: input.currentSeriesId } : {}),
        lateRule: input.lateRule,
        tieDraws,
        ...(semifinalPicks ? { semifinalPicks } : {}),
        ...(semifinalDraft ? { semifinalDraft } : {}),
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Invalid ? error.message : 'The tournament data is malformed.' };
  }
}

import type { Ballot, Game, Placement, Player, PlayerId, Poll, Result, Series, SeriesStage, Stage, TieDraw, Tournament } from '../types/tournament.js';
import { isSupportedCount } from './format.js';

// Turns untrusted JSON (a PUT body on the server, a GET response in the
// browser) into a Tournament, or explains what is wrong. It never throws and
// rebuilds every object field by field, so unknown keys are dropped and a
// malformed document can never be saved or rendered.

const STAGES: readonly Stage[] = ['setup', 'groups', 'playIn', 'semis', 'final', 'done'];
const SERIES_STAGES: readonly SeriesStage[] = ['group', 'playIn', 'semi', 'final'];

class Invalid extends Error {}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Invalid(message);
}

const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isString = (value: unknown): value is string => typeof value === 'string';
const optionalString = (value: unknown) => value === undefined || isString(value);

function parsePlayer(value: unknown, path: string): Player {
  check(isObject(value) && isString(value.id) && value.id && isString(value.name) && value.name, `${path} must have an id and a name.`);
  return { id: value.id, name: value.name };
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

function parsePoll(value: unknown, path: string, players: readonly PlayerId[]): Poll {
  check(isObject(value) && isObject(value.votes) && isString(value.recordedAt), `${path} must have votes and recordedAt.`);
  const votes: Record<PlayerId, number> = {};
  for (const [playerId, count] of Object.entries(value.votes)) {
    check(players.includes(playerId), `${path}.votes has a vote for someone outside the series.`);
    check(typeof count === 'number' && Number.isInteger(count) && count >= 0, `${path}.votes must be whole numbers.`);
    votes[playerId] = count;
  }
  let ballots: Ballot[] | undefined;
  if (value.ballots !== undefined) {
    check(Array.isArray(value.ballots), `${path}.ballots must be a list.`);
    ballots = value.ballots.map((ballot, index) => {
      check(
        isObject(ballot) && isString(ballot.discordId) && isString(ballot.username) && isString(ballot.playerId) && players.includes(ballot.playerId),
        `${path}.ballots[${index}] is invalid.`
      );
      return { discordId: ballot.discordId, username: ballot.username, playerId: ballot.playerId };
    });
  }
  return { votes, ...(ballots ? { ballots } : {}), recordedAt: value.recordedAt };
}

function parseSeries(value: unknown, path: string, knownPlayers: ReadonlySet<PlayerId>): Series {
  check(isObject(value), `${path} must be an object.`);
  check(isString(value.id) && value.id, `${path}.id is missing.`);
  check(isString(value.stage) && (SERIES_STAGES as readonly string[]).includes(value.stage), `${path}.stage is invalid.`);
  check(isString(value.label), `${path}.label is missing.`);
  check(value.winsNeeded === 1 || value.winsNeeded === 2, `${path}.winsNeeded must be 1 or 2.`);
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

export function parseTournament(input: unknown): Result<Tournament> {
  try {
    check(isObject(input), 'The tournament must be an object.');
    check(input.schemaVersion === 1, 'Unknown schema version.');
    check(typeof input.version === 'number' && Number.isInteger(input.version) && input.version >= 0, 'version must be a whole number.');
    check(isString(input.updatedAt), 'updatedAt must be a string.');
    check(isString(input.name) && input.name.length <= 80, 'name must be a short string.');
    check(isString(input.stage) && (STAGES as readonly string[]).includes(input.stage), 'stage is invalid.');
    check(typeof input.lateRule === 'boolean', 'lateRule must be true or false.');

    check(Array.isArray(input.players), 'players must be a list.');
    const players = input.players.map((player, index) => parsePlayer(player, `players[${index}]`));
    check(players.length === 0 || isSupportedCount(players.length), 'There must be 21, 24, 27 or 30 players.');
    const knownPlayers = new Set(players.map((player) => player.id));
    check(knownPlayers.size === players.length, 'Player ids must be unique.');

    check(Array.isArray(input.series), 'series must be a list.');
    const series = input.series.map((entry, index) => parseSeries(entry, `series[${index}]`, knownPlayers));
    check(new Set(series.map((entry) => entry.id)).size === series.length, 'Series ids must be unique.');

    check(input.currentSeriesId === undefined || series.some((entry) => entry.id === input.currentSeriesId), 'currentSeriesId points to a missing series.');
    check(Array.isArray(input.tieDraws), 'tieDraws must be a list.');
    const tieDraws = input.tieDraws.map((draw, index) => parseTieDraw(draw, `tieDraws[${index}]`, knownPlayers));

    return {
      ok: true,
      value: {
        schemaVersion: 1,
        version: input.version,
        updatedAt: input.updatedAt,
        name: input.name,
        players,
        stage: input.stage as Stage,
        series,
        ...(isString(input.currentSeriesId) ? { currentSeriesId: input.currentSeriesId } : {}),
        lateRule: input.lateRule,
        tieDraws,
      },
    };
  } catch (error) {
    return { ok: false, error: error instanceof Invalid ? error.message : 'The tournament data is malformed.' };
  }
}

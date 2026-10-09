/**
 * Compile-time type-contract tests for types/meeting.ts.
 *
 * Two enforcement layers live in this file:
 *
 *  1. Type level — every `Expect<Equal<...>>` const below must resolve to
 *     `true`. Any drift in the exported shapes (renamed field, widened type,
 *     dropped union member, lost exhaustiveness) fails the scoped typecheck:
 *
 *       npx tsc --noEmit --strict --target es2017 --lib dom,dom.iterable,esnext \
 *         --module esnext --moduleResolution bundler --esModuleInterop \
 *         --skipLibCheck --types node types/meeting.ts types/meeting.types.test.ts
 *
 *     Explicit input files bypass tsconfig.json (documented TS behavior), so
 *     the repo's compilerOptions are mirrored as flags; `strict` applies.
 *
 *  2. Runtime level — trivial node:test smoke assertions so the file is a
 *     valid target for:
 *
 *       node --import tsx --test types/meeting.types.test.ts
 *
 *     They pin the mock data to the contracts it is annotated with.
 *
 * Relative imports only: this file intentionally imports the very module it
 * polices (`./meeting`).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  ConnectionStatus,
  ConnectionState,
  Message,
  SpeakingState,
  TimeRequest,
  User,
} from "./meeting"
import {
  CONNECTION_STATUS_CONFIG,
  MOCK_CONNECTION_STATES,
  MOCK_MESSAGES,
  MOCK_SPEAKING_STATES,
  MOCK_USERS,
  simulateSpeaking,
} from "./meeting"

// ---------------------------------------------------------------------------
// Compile-time assertion helpers
// ---------------------------------------------------------------------------

type Expect<T extends true> = T
type Equal<X, Y> =
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false

// ---------------------------------------------------------------------------
// User — every field's exact type
// ---------------------------------------------------------------------------

const _userIdIsString: Expect<Equal<User["id"], string>> = true
const _userNameIsString: Expect<Equal<User["name"], string>> = true
const _userAvatarIsString: Expect<Equal<User["avatar"], string>> = true
const _userRoleIsString: Expect<Equal<User["role"], string>> = true
const _userCompanyIsString: Expect<Equal<User["company"], string>> = true
const _userInterestsIsStringArray: Expect<Equal<User["interests"], string[]>> = true
const _userMeetingStatsShape: Expect<
  Equal<User["meetingStats"], { totalMeetings: number; totalMinutes: number; averageRating: number }>
> = true
const _userExactShape: Expect<
  Equal<
    User,
    {
      id: string
      name: string
      avatar: string
      role: string
      company: string
      interests: string[]
      meetingStats: { totalMeetings: number; totalMinutes: number; averageRating: number }
    }
  >
> = true

// ---------------------------------------------------------------------------
// Message — exact shape
// ---------------------------------------------------------------------------

const _messageExactShape: Expect<
  Equal<Message, { id: string; sender: string; message: string; timestamp: string }>
> = true

// ---------------------------------------------------------------------------
// TimeRequest — exact shape; status is exactly the literal union
// ---------------------------------------------------------------------------

const _timeRequestExactShape: Expect<
  Equal<
    TimeRequest,
    { id: string; requester: string; timestamp: string; status: "pending" | "accepted" | "rejected" }
  >
> = true
const _timeRequestStatusIsExactUnion: Expect<
  Equal<TimeRequest["status"], "pending" | "accepted" | "rejected">
> = true

// ---------------------------------------------------------------------------
// SpeakingState — open index signature string -> boolean
// ---------------------------------------------------------------------------

const _speakingStateIsIndexSignature: Expect<Equal<SpeakingState, { [key: string]: boolean }>> = true
const _speakingStateLookupIsBoolean: Expect<Equal<SpeakingState[string], boolean>> = true

// ---------------------------------------------------------------------------
// ConnectionStatus — exactly the four-member union
// ---------------------------------------------------------------------------

const _connectionStatusIsExactUnion: Expect<
  Equal<ConnectionStatus, "excellent" | "good" | "poor" | "offline">
> = true

// ---------------------------------------------------------------------------
// ConnectionState — exact shape
// ---------------------------------------------------------------------------

const _connectionStateExactShape: Expect<
  Equal<ConnectionState, { status: ConnectionStatus; latency: number }>
> = true

// ---------------------------------------------------------------------------
// CONNECTION_STATUS_CONFIG — declared type, assignability, exhaustiveness
// ---------------------------------------------------------------------------

const _configDeclaredType: Expect<
  Equal<typeof CONNECTION_STATUS_CONFIG, Record<ConnectionStatus, { color: string; label: string }>>
> = true

// Assignability probe (assignability only, no Equal required).
const _configAssignableToRecord: Record<ConnectionStatus, { color: string; label: string }> =
  CONNECTION_STATUS_CONFIG

// Exhaustiveness: indexing the config by the full union yields the entry shape.
const _exhaustiveCheck: Expect<
  Equal<
    (typeof CONNECTION_STATUS_CONFIG)["excellent" | "good" | "poor" | "offline"] extends {
      color: string
      label: string
    }
      ? true
      : false,
    true
  >
> = true

// Exhaustiveness: the config's own key set is exactly ConnectionStatus.
const _configKeysAreExactlyConnectionStatus: Expect<
  Equal<keyof typeof CONNECTION_STATUS_CONFIG, ConnectionStatus>
> = true

// Exhaustiveness: Record<ConnectionStatus, true> assignment probe — every
// status key must accept a `true` under the config's key set.
const _configRecordTrueProbe: Expect<
  Equal<
    { [K in keyof typeof CONNECTION_STATUS_CONFIG]: true } extends Record<ConnectionStatus, true>
      ? true
      : false,
    true
  >
> = true

// Exhaustiveness: mapping over ConnectionStatus reproduces the config exactly
// (no missing keys, no extra keys, no widened entry type).
const _configMappedOverStatusReproducesConfig: Expect<
  Equal<
    { [K in ConnectionStatus]: (typeof CONNECTION_STATUS_CONFIG)[K] },
    typeof CONNECTION_STATUS_CONFIG
  >
> = true

// ---------------------------------------------------------------------------
// Mock data conformance
// ---------------------------------------------------------------------------

const _mockUsersConformToUser: Expect<
  Equal<typeof MOCK_USERS extends { [key: string]: User } ? true : false, true>
> = true
const _mockMessagesConformToMessage: Expect<Equal<typeof MOCK_MESSAGES, Message[]>> = true
const _mockSpeakingStatesConform: Expect<Equal<typeof MOCK_SPEAKING_STATES, SpeakingState>> = true
const _mockConnectionStatesConform: Expect<
  Equal<typeof MOCK_CONNECTION_STATES, Record<string, ConnectionState>>
> = true

// ---------------------------------------------------------------------------
// simulateSpeaking — inferred return type is pinned and assignable
// ---------------------------------------------------------------------------

const _simulateSpeakingReturnType: Expect<
  Equal<ReturnType<typeof simulateSpeaking>, { you: boolean; partner: boolean }>
> = true
const _simulateSpeakingAssignableToSpeakingState: Expect<
  Equal<typeof simulateSpeaking extends () => SpeakingState ? true : false, true>
> = true

// ---------------------------------------------------------------------------
// Runtime smoke tests (node:test)
// ---------------------------------------------------------------------------

const CONNECTION_STATUSES: readonly ConnectionStatus[] = ["excellent", "good", "poor", "offline"]

test("CONNECTION_STATUS_CONFIG covers every ConnectionStatus with color and label", () => {
  assert.deepStrictEqual(Object.keys(CONNECTION_STATUS_CONFIG).sort(), [
    "excellent",
    "good",
    "offline",
    "poor",
  ])
  for (const status of CONNECTION_STATUSES) {
    const entry = CONNECTION_STATUS_CONFIG[status]
    assert.ok(entry, `missing entry for ${status}`)
    assert.strictEqual(typeof entry.color, "string")
    assert.ok(entry.color.length > 0, `empty color for ${status}`)
    assert.strictEqual(typeof entry.label, "string")
    assert.ok(entry.label.length > 0, `empty label for ${status}`)
  }
})

test("MOCK_USERS values conform to User", () => {
  const keys = Object.keys(MOCK_USERS)
  assert.ok(keys.length >= 2, "expected at least the 'you' and 'partner' mock users")
  for (const key of keys) {
    const user: User | undefined = MOCK_USERS[key]
    assert.ok(user, `mock user "${key}" is falsy`)
    assert.strictEqual(typeof user.id, "string")
    assert.strictEqual(typeof user.name, "string")
    assert.strictEqual(typeof user.avatar, "string")
    assert.strictEqual(typeof user.role, "string")
    assert.strictEqual(typeof user.company, "string")
    assert.ok(Array.isArray(user.interests))
    assert.strictEqual(typeof user.meetingStats.totalMeetings, "number")
    assert.strictEqual(typeof user.meetingStats.totalMinutes, "number")
    assert.strictEqual(typeof user.meetingStats.averageRating, "number")
  }
})

test("MOCK_MESSAGES conform to Message", () => {
  assert.ok(Array.isArray(MOCK_MESSAGES))
  assert.strictEqual(MOCK_MESSAGES.length, 2)
  for (const message of MOCK_MESSAGES) {
    assert.strictEqual(typeof message.id, "string")
    assert.strictEqual(typeof message.sender, "string")
    assert.strictEqual(typeof message.message, "string")
    assert.strictEqual(typeof message.timestamp, "string")
  }
})

test("MOCK_SPEAKING_STATES holds boolean flags", () => {
  assert.strictEqual(typeof MOCK_SPEAKING_STATES.you, "boolean")
  assert.strictEqual(typeof MOCK_SPEAKING_STATES.partner, "boolean")
})

test("MOCK_CONNECTION_STATES conform to ConnectionState", () => {
  const keys = Object.keys(MOCK_CONNECTION_STATES)
  assert.ok(keys.length >= 2, "expected at least the 'you' and 'partner' mock states")
  for (const key of keys) {
    const state: ConnectionState | undefined = MOCK_CONNECTION_STATES[key]
    assert.ok(state, `mock connection state "${key}" is falsy`)
    assert.ok(
      (CONNECTION_STATUSES as readonly string[]).indexOf(state.status) !== -1,
      `invalid status "${state.status}" for "${key}"`,
    )
    assert.strictEqual(typeof state.latency, "number")
  }
})

test("simulateSpeaking returns boolean flags for you and partner", () => {
  const speaking = simulateSpeaking()
  assert.strictEqual(typeof speaking.you, "boolean")
  assert.strictEqual(typeof speaking.partner, "boolean")
})

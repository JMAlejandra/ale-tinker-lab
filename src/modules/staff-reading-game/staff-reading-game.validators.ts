import { z } from 'zod'

import { isCanonicalNote } from './staff-reading-game.notes'
import {
  CLEFS,
  MODES,
  NOTE_NAMINGS,
  RANGE_PRESETS,
  SESSION_TYPES,
  type Attempt,
  type CanonicalNote,
  type LocalProfile,
  type Session,
  type Settings,
} from './staff-reading-game.types'

export const CURRENT_SCHEMA_VERSION = 1

const isoTimestamp = z.string().datetime()
const nonNegativeInt = z.number().int().nonnegative()

const canonicalNoteSchema = z
  .string()
  .refine((value): value is CanonicalNote => isCanonicalNote(value), {
    message: 'Not a canonical note',
  })

export const profileSchema = z.object({
  id: z.string().min(1),
  createdAt: isoTimestamp,
  linkedUserId: z.string().nullable(),
}) satisfies z.ZodType<LocalProfile>

export const settingsSchema = z.object({
  ownerId: z.string().min(1),
  mode: z.enum(MODES),
  sessionType: z.enum(SESSION_TYPES),
  clef: z.enum(CLEFS),
  rangePreset: z.enum(RANGE_PRESETS),
  noteNaming: z.enum(NOTE_NAMINGS),
  strictOctave: z.boolean(),
  soundOn: z.boolean(),
  previewSound: z.boolean(),
  updatedAt: isoTimestamp,
}) satisfies z.ZodType<Settings>

export const sessionSchema = z.object({
  id: z.string().min(1),
  ownerId: z.string().min(1),
  mode: z.enum(MODES),
  sessionType: z.enum(SESSION_TYPES),
  clef: z.enum(CLEFS),
  rangePreset: z.enum(RANGE_PRESETS),
  strictOctave: z.boolean(),
  startedAt: isoTimestamp,
  endedAt: isoTimestamp.nullable(),
  completed: z.boolean(),
  score: z.number().nullable(),
  correctCount: nonNegativeInt,
  totalCount: nonNegativeInt,
  bestStreak: nonNegativeInt,
  syncedAt: isoTimestamp.nullable(),
}) satisfies z.ZodType<Session>

export const attemptSchema = z.object({
  id: z.string().min(1),
  sessionId: z.string().min(1),
  ownerId: z.string().min(1),
  position: nonNegativeInt,
  targetNote: canonicalNoteSchema,
  clef: z.enum(CLEFS),
  answer: z.string(),
  isCorrect: z.boolean(),
  responseMs: z.number().nonnegative(),
  points: z.number(),
  streakAfter: nonNegativeInt,
  wasRequeued: z.boolean(),
  answeredAt: isoTimestamp,
  syncedAt: isoTimestamp.nullable(),
}) satisfies z.ZodType<Attempt, z.ZodTypeDef, unknown>

/** The single versioned document kept under the progress storage key. */
export const progressDocumentSchema = z.object({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  profile: profileSchema,
  settings: settingsSchema.nullable(),
  sessions: z.array(sessionSchema),
  attempts: z.array(attemptSchema),
})

export type ProgressDocument = z.infer<typeof progressDocumentSchema>

/** Stored hint flags: hint name -> seen. */
export const hintFlagsSchema = z.record(z.boolean())

/**
 * Brings a raw stored value up to the current schema version.
 * Returns `null` when the value is unknown, cannot be migrated or fails validation; never throws.
 * v1 is the only version so far; add `case` branches here as versions are introduced.
 */
export function migrate(raw: unknown): ProgressDocument | null {
  if (typeof raw !== 'object' || raw === null) return null
  const version = (raw as { schemaVersion?: unknown }).schemaVersion
  switch (version) {
    case CURRENT_SCHEMA_VERSION: {
      const parsed = progressDocumentSchema.safeParse(raw)
      return parsed.success ? parsed.data : null
    }
    default:
      return null
  }
}

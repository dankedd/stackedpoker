/**
 * The XP → level curve now lives in `@/lib/levels` (shared/levels.json, one
 * table for frontend, backend and SQL). Re-exported here so existing Learn
 * imports keep working — never add a second implementation.
 */
export {
  getLevelProgress,
  levelForXP,
  xpRequiredForLevel,
  MAX_LEVEL,
  type LevelProgress,
} from '@/lib/levels'

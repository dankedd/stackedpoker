// Standalone scenario-consistency audit — run any time with:
//   node scripts/run-ts.js scripts/validate-scenarios.ts
// Wraps the exact same lib/learn/scenarioValidator.ts logic the vitest regression
// suite (lib/learn/__tests__/scenarioValidation.test.ts) runs on every test pass —
// one validator, two callers, never two implementations. Use this when you want a
// full human-readable report instead of a pass/fail CI gate (e.g. auditing a batch
// of new lessons before committing them).
import { LESSONS } from '@/lib/learn/curriculum'
import { validateAllLessons } from '@/lib/learn/scenarioValidator'

export function main() {
  const report = validateAllLessons(LESSONS)

  console.log(`Lessons audited:            ${report.totalLessons}`)
  console.log(`PreflopTable scenarios validated: ${report.totalScenariosValidated}`)
  console.log(`Issues found:               ${report.issues.length}`)
  console.log()

  if (report.issues.length === 0) {
    console.log('Every PreflopTable-rendering scenario matches its authored data. ✓')
    return
  }

  const byField = new Map<string, number>()
  for (const issue of report.issues) byField.set(issue.field, (byField.get(issue.field) ?? 0) + 1)
  console.log('By field:')
  for (const [field, count] of [...byField.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${field.padEnd(22)} ${count}`)
  }
  console.log()

  for (const issue of report.issues) {
    console.log(`--- ${issue.lessonId} / ${issue.stepId}  [${issue.field}] ---`)
    console.log(`  ${issue.message}`)
  }

  console.log()
  console.log(`${report.issues.length} issue(s) found across ${report.totalScenariosValidated} scenarios.`)
  process.exitCode = 1
}

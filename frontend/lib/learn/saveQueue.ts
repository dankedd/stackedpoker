/**
 * A strict FIFO async queue. Tasks always run — and their results always
 * resolve — in the order they were enqueued, even if a later task's promise
 * would otherwise settle before an earlier one's (e.g. a fast connection
 * beating a slow one for two nearly-simultaneous requests).
 *
 * Built for LearnProgressContext: two rapid progress saves (answer step A,
 * then step B) must always reach the server in that order, or a slower
 * request for A could land after B and regress the learner's resume
 * position / XP with stale data. See the "MULTIPLE SAVES / RACE CONDITIONS"
 * requirement in the persistence audit this was written for.
 */
export function createSequentialQueue() {
  let tail: Promise<unknown> = Promise.resolve()

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = tail.then(task, task)
    // Swallow so one failed task never poisons the chain for tasks after it.
    tail = run.then(
      () => undefined,
      () => undefined,
    )
    return run
  }

  return { enqueue }
}

# Run Lifecycle

## States
- draft
- queued
- running
- waiting_analysis
- analyzing
- complete
- failed
- canceled

## Transitions
- draft -> queued (user confirms queries)
- queued -> running (jobs dispatched)
- running -> waiting_analysis (pending_count == 0)
- waiting_analysis -> analyzing (enqueue insight job)
- analyzing -> complete (insight done)
- any -> failed (fatal error)
- any -> canceled (user action)

## Analysis trigger
- On response save: decrement pending_count.
- When pending_count == 0, enqueue analysis job.
- Analysis job writes insights + charts and marks run complete.


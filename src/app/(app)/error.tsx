'use client'

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="welcome-banner">
      <p className="page-kicker mb-2">ERROR</p>
      <h1>This section failed to load</h1>
      <p>{error.message || 'Try again. Your session and data were not changed.'}</p>
      <button type="button" className="btn btn-accent mt-3" onClick={() => reset()}>
        Reload section
      </button>
    </section>
  )
}

export default function SetupNotice({ message }: { message?: string }) {
  return (
    <div className="max-w-lg rounded-lg border border-brand/40 bg-elevated p-8 text-center">
      <h2 className="text-xl font-bold text-brand">One step left</h2>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {message ??
          "TMDB API key not configured. Movie metadata needs a free TMDB key."}
      </p>
      <ol className="mx-auto mt-4 max-w-sm list-left space-y-1.5 text-left text-xs text-muted">
        <li>1. Create a free account at themoviedb.org</li>
        <li>2. Settings → API → Request an API Key (Developer)</li>
        <li>3. Copy the key into <code className="text-white">.env.local</code>:</li>
      </ol>
      <pre className="mt-3 rounded bg-black px-4 py-2 text-left text-xs text-green-400">
        TMDB_API_KEY=your_key_here
      </pre>
      <p className="mt-3 text-xs text-muted">Then restart <code>npm run dev</code>.</p>
    </div>
  );
}

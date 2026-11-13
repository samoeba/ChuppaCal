"use client";

export default function ErrorPage({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div role="alert" className="m-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-bold">We couldn’t load this page</h1>
      <p className="mt-3">Check your connection and try again. Your saved information has not been removed.</p>
      <button onClick={retry} className="mt-5 rounded-xl bg-cc-ink px-6 py-3 text-white font-semibold">Try again</button>
    </div>
  );
}

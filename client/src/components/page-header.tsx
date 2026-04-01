export function SiteLogo() {
  return (
    <div className="mb-3 flex items-center gap-2">
      <img src="/favicon.svg" alt="Logo" className="h-10 w-auto" />
      {import.meta.env.VITE_APP_ENV === "staging" && (
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
          STAGING
        </span>
      )}
    </div>
  );
}

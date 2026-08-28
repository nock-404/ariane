export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-10">
      <div className="flex flex-col items-center gap-3 text-dim">
        <span className="size-5 animate-spin rounded-full border-2 border-line border-t-[var(--moss)]" />
        <p className="text-sm">Einen Moment, die Wochen werden geladen …</p>
      </div>
    </div>
  );
}

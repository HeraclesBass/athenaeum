export default function LibraryLoading() {
  return (
    <div>
      <div className="skeleton h-7 w-56 mb-3" />
      <div className="skeleton h-3.5 w-80 mb-6" />
      <div className="skeleton h-10 w-full max-w-xl mb-8" />
      <div className="grid gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="skeleton h-14 w-full" />
        ))}
      </div>
    </div>
  );
}

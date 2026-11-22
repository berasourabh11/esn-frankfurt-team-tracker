import { Skeleton } from "@/components/ui/skeleton";

export function UpcomingSkeleton() {
  return (
    <div className="flex flex-col gap-8" aria-busy="true" aria-label="Loading events">
      <Skeleton className="h-36 rounded-2xl" />
      <Skeleton className="h-4 w-48" />
      {[0, 1].map((group) => (
        <div key={group} className="flex flex-col gap-4">
          <Skeleton className="h-7 w-32" />
          <div className="grid gap-4 lg:grid-cols-2">
            {[0, 1, 2, 3].map((card) => (
              <div key={card} className="flex h-36 overflow-hidden rounded-2xl border bg-card">
                <Skeleton className="h-full w-24 rounded-none" />
                <div className="flex flex-1 flex-col gap-3 p-5">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

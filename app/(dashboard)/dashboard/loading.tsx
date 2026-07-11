// Route-level loading state for /dashboard/* — skeleton panels that echo the
// real 12-column layout (structure, not spinners), pulsing opacity only.

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1200px]" role="status" aria-busy aria-label="Loading dashboard">
      <div className="mb-6 flex items-end justify-between">
        <div className="space-y-2">
          <div className="cx-skeleton h-3 w-20" />
          <div className="cx-skeleton h-6 w-44" />
        </div>
        <div className="cx-skeleton h-3 w-28" />
      </div>

      <div className="mb-6 flex gap-1 border-b border-border pb-2">
        <div className="cx-skeleton h-8 w-24" />
        <div className="cx-skeleton h-8 w-24" />
        <div className="cx-skeleton h-8 w-24" />
      </div>

      <div className="grid gap-3 lg:grid-cols-12">
        <div className="cx-skeleton h-[320px] lg:col-span-7" />
        <div className="grid grid-cols-2 gap-3 lg:col-span-5">
          <div className="cx-skeleton h-[110px]" />
          <div className="cx-skeleton h-[110px]" />
          <div className="cx-skeleton h-[110px]" />
          <div className="cx-skeleton h-[110px]" />
        </div>
        <div className="cx-skeleton h-[260px] lg:col-span-7" />
        <div className="cx-skeleton h-[260px] lg:col-span-5" />
      </div>
    </div>
  )
}

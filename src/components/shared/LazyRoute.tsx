import { Suspense } from 'react'
import { PageLoadingSpinner } from '@/components/ui/LoadingSpinner'

interface LazyRouteProps {
  children: React.ReactNode
}

function LazyRoute({ children }: LazyRouteProps) {
  return (
    <Suspense fallback={<PageLoadingSpinner />}>
      {children}
    </Suspense>
  )
}

export default LazyRoute

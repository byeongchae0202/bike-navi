import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { CrashAlertModal } from './CrashAlertModal'
import { RideMetricsProvider, useRideMetrics } from '../store/RideMetricsProvider'

function RootLayoutBody() {
  const location = useLocation()
  const isNavigationPage = location.pathname === '/navigate'
  const {
    metrics: { crashDetected },
    dismissCrashAlert,
  } = useRideMetrics()

  return (
    <div className="min-h-dvh text-slate-100">
      <main className={isNavigationPage ? '' : 'pb-24'}>
        <Outlet />
      </main>
      {!isNavigationPage && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-700/70 bg-slate-950/90 px-4 py-3 backdrop-blur">
          <div className="mx-auto grid w-full max-w-3xl grid-cols-2 gap-2">
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-300'
                }`
              }
            >
              대시보드
            </NavLink>
            <NavLink
              to="/navigate"
              className={({ isActive }) =>
                `rounded-xl px-4 py-3 text-center text-sm font-semibold ${
                  isActive ? 'bg-blue-500 text-white' : 'bg-slate-900 text-slate-300'
                }`
              }
            >
              지도
            </NavLink>
          </div>
        </nav>
      )}
      <CrashAlertModal open={crashDetected} onClose={dismissCrashAlert} />
    </div>
  )
}

export function RootLayout() {
  return (
    <RideMetricsProvider>
      <RootLayoutBody />
    </RideMetricsProvider>
  )
}

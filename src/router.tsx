import { Navigate, createBrowserRouter } from 'react-router-dom'
import { DashboardPage } from './pages/DashboardPage'
import { NavigationPage } from './pages/NavigationPage'
import { RootLayout } from './components/RootLayout'

export const appRouter = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <Navigate to="/navigate" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'navigate', element: <NavigationPage /> },
      { path: '*', element: <Navigate to="/navigate" replace /> },
    ],
  },
])

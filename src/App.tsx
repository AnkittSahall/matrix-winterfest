import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Play } from './pages/Play'
import { FinalResult } from './pages/FinalResult'
import { Admin } from './pages/Admin'
import { HomeTabs } from './pages/HomeTabs'
import { LiveArena } from './pages/LiveArena'

export default function App() {
  const location = useLocation()
  const live = location.pathname === '/live'

  return (
    <div className={live ? undefined : 'app-bg'}>
      <Routes>
        <Route path="/" element={<HomeTabs />} />
        <Route path="/play/:runId" element={<Play />} />
        <Route path="/play/:runId/final" element={<FinalResult />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/live" element={<LiveArena />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

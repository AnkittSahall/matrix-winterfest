import { Navigate, Route, Routes } from 'react-router-dom'
import { Play } from './pages/Play'
import { FinalResult } from './pages/FinalResult'
import { Admin } from './pages/Admin'
import { HomeTabs } from './pages/HomeTabs'

export default function App() {
  return (
    <div className="app-bg">
      <Routes>
        <Route path="/" element={<HomeTabs />} />
        <Route path="/play/:runId" element={<Play />} />
        <Route path="/play/:runId/final" element={<FinalResult />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}

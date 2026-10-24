import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import StudyArea from './pages/StudyArea';
import Analysis from './pages/Analysis';
import ModelReport from './pages/ModelReport';
import Results from './pages/Results';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<AppLayout />}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="study-area" element={<StudyArea />} />
        <Route path="analysis" element={<Analysis />} />
        <Route path="model" element={<ModelReport />} />
        <Route path="results" element={<Results />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

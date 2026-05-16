import { Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      {/* TODO: add routes for /events, /sellers/:id, /orders, /dashboard, /auth */}
    </Routes>
  );
}

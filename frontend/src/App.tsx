import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import DashboardPage from './pages/DashboardPage';
import ProductList from './components/ProductList'; // Це наша сторінка "Склад"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Головна сторінка - Дашборд */}
          <Route index element={<DashboardPage />} />
          
          {/* Сторінка складу */}
          <Route path="inventory" element={<ProductList />} />
          
          {/* Тут можна буде додати Route path="history" ... */}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
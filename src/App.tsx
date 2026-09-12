import { BrowserRouter, Routes, Route } from 'react-router-dom';

// IMPORTAÇÕES REAIS DAS SUAS TELAS
import Agentes from './pages/Agentes'; 
import Ocorrencias from './pages/Ocorrencias'; 

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Tela Inicial temporária */}
        <Route path="/" element={<Agentes />} />
        
        {/* Suas duas telas funcionando */}
        <Route path="/agentes" element={<Agentes />} />
        <Route path="/ocorrencias" element={<Ocorrencias />} />
      </Routes>
    </BrowserRouter>
  );
}
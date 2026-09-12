import { AlertTriangle, FileText, Map, Users } from 'lucide-react';
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();

  const menuItems = [
    { name: 'Monitoramento (Mapa)', path: '/', icon: <Map size={20} /> },
    { name: 'Agentes e Dispositivos', path: '/agentes', icon: <Users size={20} /> },
    { name: 'Ocorrências e Alertas', path: '/ocorrencias', icon: <AlertTriangle size={20} /> },
    { name: 'Relatórios Consolidados', path: '/relatorios', icon: <FileText size={20} /> },
  ];

  return (
    <div className="w-64 h-screen bg-gray-900 text-white flex flex-col fixed left-0 top-0">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <div className="w-4 h-4 bg-mackenzie rounded-full"></div>
          Mackenzie Tático
        </h1>
        <p className="text-xs text-gray-400 mt-1 uppercase tracking-widest">Central de Comando</p>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors duration-200 ${
                isActive ? 'bg-mackenzie text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
              }`}
            >
              {item.icon}
              <span className="font-medium text-sm">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center font-bold">
            G
          </div>
          <div>
            <p className="text-sm font-medium">Gestor Atual</p>
            <p className="text-xs text-green-400">● Online</p>
          </div>
        </div>
      </div>
    </div>
  );
}
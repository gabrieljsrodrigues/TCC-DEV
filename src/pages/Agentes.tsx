import { 
  Bell, Camera, FileText, LogOut, Map as MapIcon, 
  Plus, Search, ShieldAlert, SlidersHorizontal, Smartphone, 
  Trash2, User, Users, X, Battery, Wifi, WifiOff, MessageSquare, Send, Activity, CheckCircle, AlertCircle, Check
} from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

import { supabase } from '../services/supabase';

interface MensagemChat {
  id: string;
  remetente: string;
  perfil: 'AGENTE' | 'CENTRAL';
  mensagem: string;
  agente_matricula: string;
  created_at: string;
}

export default function Agentes() {
  const [isAgentModalOpen, setAgentModalOpen] = useState(false);
  const [isTodosModalOpen, setTodosModalOpen] = useState(false);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  
  const [agenteEmEdicao, setAgenteEmEdicao] = useState<any>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);

  const [nomeDigitado, setNomeDigitado] = useState('');
  const [matriculaDigitada, setMatriculaDigitada] = useState('');
  const [turnoSelecionado, setTurnoSelecionado] = useState('');

  const [listaAgentes, setListaAgentes] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [notificacao, setNotificacao] = useState<{tipo: 'sucesso' | 'erro' | 'info', mensagem: string} | null>(null);
  const [modalConfirmacao, setModalConfirmacao] = useState<{ visivel: boolean, titulo: string, mensagem: string, acao: () => void } | null>(null);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 4000); 
  };

  const [isChatOpen, setIsChatOpen] = useState(false);
  const [agenteChatAtual, setAgenteChatAtual] = useState<string>('');
  const matriculaChatRef = useRef<string>(''); 
  const isChatOpenRef = useRef<boolean>(false);
  const [mensagens, setMensagens] = useState<MensagemChat[]>([]);
  const [novaMensagem, setNovaMensagem] = useState('');
  const [statusAntena, setStatusAntena] = useState<string>('Conectando...');
  const [mensagensNaoLidas, setMensagensNaoLidas] = useState<Record<string, boolean>>({});
  const mensagensFimRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    carregarTudo();

    const channelAgentes = supabase
      .channel('mudancas-agentes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'agentes_autorizados' }, () => {
        carregarTudo(); 
      })
      .subscribe();

    const channelChat = supabase
      .channel('chat_painel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'mensagens_chat' }, payload => {
        const novaMsg = payload.new as MensagemChat;
        if (novaMsg.perfil === 'AGENTE') {
          if (!isChatOpenRef.current || matriculaChatRef.current !== novaMsg.agente_matricula) {
            setMensagensNaoLidas(prev => ({ ...prev, [novaMsg.agente_matricula]: true }));
          }
        }
        if (novaMsg.agente_matricula === matriculaChatRef.current) {
          setMensagens(prev => {
            if (prev.some(m => m.id === novaMsg.id)) return prev;
            return [...prev, novaMsg];
          });
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setStatusAntena('🟢 Antena Ligada');
        else if (status === 'CLOSED') setStatusAntena('🔴 Antena Desligada');
        else if (status === 'CHANNEL_ERROR') setStatusAntena('⚠️ Erro de Rede');
      });

    // --- NOVA ANTENA: VIGIA DE PRESENÇA (AUTO-CURA DE CONEXÕES FANTASMAS) ---
    const channelPresence = supabase.channel('vigia-presenca');

    channelPresence
      .on('presence', { event: 'sync' }, async () => {
        // 1. Quem o Supabase diz que realmente está com o app aberto e conectado agora?
        const estadoPresenca = channelPresence.presenceState();
        const matriculasRealmenteOnline = Object.keys(estadoPresenca);
        
        // 2. Busca no banco quem "ficou travado" como Online de ontem ou porque matou o app
        const { data: supostosOnline } = await supabase
          .from('agentes_autorizados')
          .select('id, matricula')
          .eq('status_conexao', 'Online');
          
        if (supostosOnline) {
           for (const ag of supostosOnline) {
              if (!matriculasRealmenteOnline.includes(ag.matricula)) {
                  // Se o banco diz que tá online, mas não tem WebSocket físico conectado: limpa!
                  await supabase.from('agentes_autorizados')
                    .update({ status_conexao: 'Offline' })
                    .eq('id', ag.id);
              }
           }
        }
      })
      .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
        // Se a central estiver aberta e um agente fechar o app na hora, arruma na mesma hora!
        for (const agente of leftPresences) {
          await supabase.from('agentes_autorizados')
            .update({ status_conexao: 'Offline' })
            .eq('matricula', agente.matricula);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channelAgentes);
      supabase.removeChannel(channelChat);
      supabase.removeChannel(channelPresence);
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens, isChatOpen]);

  const carregarTudo = async () => {
    try {
      const { data: agentes } = await supabase.from('agentes_autorizados').select('*').order('nome', { ascending: true });
      setListaAgentes(agentes || []);
    } catch (error) {
      console.error("Erro ao carregar dados:", error);
    } finally {
      setCarregando(false);
    }
  };

  const handleAbrirChat = async (nome: string, matricula: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setAgenteChatAtual(nome);
    matriculaChatRef.current = matricula; 
    isChatOpenRef.current = true; 
    setIsChatOpen(true);
    setMensagensNaoLidas(prev => ({ ...prev, [matricula]: false }));
    
    const { data } = await supabase
      .from('mensagens_chat')
      .select('*')
      .eq('agente_matricula', matricula)
      .order('created_at', { ascending: true })
      .limit(50);
      
    if (data) setMensagens(data as MensagemChat[]);
  };

  const fecharChat = () => {
    setIsChatOpen(false);
    isChatOpenRef.current = false;
    matriculaChatRef.current = '';
  };

  const enviarMensagem = async () => {
    if (!novaMensagem.trim() || !matriculaChatRef.current) return;
    const txt = novaMensagem.trim();
    setNovaMensagem('');

    try {
      const { data, error } = await supabase.from('mensagens_chat').insert([{
        remetente: 'Painel Central',
        perfil: 'CENTRAL',
        mensagem: txt,
        agente_matricula: matriculaChatRef.current 
      }]).select();

      if (error) throw new Error(error.message);
      
      if (data) {
        setMensagens(prev => {
          if (prev.some(m => m.id === data[0].id)) return prev;
          return [...prev, data[0] as MensagemChat];
        });
      }
    } catch (error: any) {
      mostrarNotificacao('erro', "Erro ao enviar: " + (error.message || "Verifique sua conexão"));
      setNovaMensagem(txt);
    }
  };

  const scrollToBottom = () => {
    if (mensagensFimRef.current) {
      mensagensFimRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const formatarHora = (dataString: string) => {
    return new Date(dataString).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const handleSalvarAgente = async () => {
    if (!nomeDigitado || !matriculaDigitada || !turnoSelecionado) { 
      mostrarNotificacao('erro', "Preencha todos os campos obrigatórios."); 
      return; 
    }

    const matriculaLimpa = matriculaDigitada.trim();
    const emailGerado = `${matriculaLimpa}@seguranca.local`;
    
    try {
      const { error } = await supabase.from('agentes_autorizados').insert([{ 
        nome: nomeDigitado, 
        matricula: matriculaLimpa, 
        email_pessoal: emailGerado,
        turno: turnoSelecionado, 
        status_operacional: 'Inativo',
        status: 'AGUARDANDO_SENHA'
      }]);

      if (error) throw error; 

      mostrarNotificacao('sucesso', "Agente cadastrado com sucesso!");
      setNomeDigitado(''); setMatriculaDigitada(''); setTurnoSelecionado(''); setFotoPreview(null); setAgentModalOpen(false); carregarTudo(); 
    } catch (error: any) { 
      console.error(error);
      mostrarNotificacao('erro', "Erro: A matrícula já existe no sistema."); 
    }
  };

  const handleSalvarEdicao = async () => {
    try {
      const { error } = await supabase.from('agentes_autorizados').update({ nome: agenteEmEdicao.nome, turno: agenteEmEdicao.turno }).eq('id', agenteEmEdicao.id);
      
      if (error) throw error;

      mostrarNotificacao('sucesso', "Dados atualizados com sucesso!"); 
      setEditModalOpen(false); 
      carregarTudo();
    } catch (error) { 
      mostrarNotificacao('erro', "Erro ao atualizar os dados."); 
    }
  };

  const handleExcluirAgente = () => {
    setModalConfirmacao({
      visivel: true,
      titulo: "Excluir Cadastro",
      mensagem: `Tem certeza que deseja excluir permanentemente o cadastro de ${agenteEmEdicao.nome}?`,
      acao: async () => {
        try {
          const { error } = await supabase.from('agentes_autorizados').delete().eq('id', agenteEmEdicao.id);
          if (error) throw error;

          setModalConfirmacao(null);
          setEditModalOpen(false); 
          carregarTudo();
          mostrarNotificacao('sucesso', "Cadastro excluído com sucesso.");
        } catch (e) {
          mostrarNotificacao('erro', "Falha ao excluir o cadastro.");
        }
      }
    });
  };

  const handleDesconectarAgente = (matricula: string, nome: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setModalConfirmacao({
      visivel: true,
      titulo: "Desconectar Agente",
      mensagem: `Forçar o fim do turno de ${nome}? O dispositivo será desconectado da central.`,
      acao: async () => {
        try {
          await supabase.from('agentes_autorizados')
            .update({ status_operacional: 'Inativo', status_conexao: 'Offline' })
            .eq('matricula', matricula);
          
          await supabase.channel('comandos-logout').send({
            type: 'broadcast',
            event: 'forcar-logout',
            payload: { matriculaAlvo: matricula }
          });
          setModalConfirmacao(null);
          mostrarNotificacao('sucesso', `Sinal de desconexão enviado para ${nome}.`);
        } catch (e) {
          mostrarNotificacao('erro', "Falha ao desconectar o dispositivo.");
        }
      }
    });
  };

  const handleNotificarAgente = async (matricula: string, nome: string, e: React.MouseEvent) => {
    e.stopPropagation(); 
    try {
      await supabase.channel('comandos-central').send({
        type: 'broadcast',
        event: 'tocar-sino',
        payload: { matriculaAlvo: matricula }
      });
      mostrarNotificacao('sucesso', `Alerta sonoro enviado para ${nome}!`);
    } catch (error) {
      mostrarNotificacao('erro', `Erro ao tentar notificar o agente ${nome}.`);
    }
  };

  const abrirEdicao = (agente: any) => { setAgenteEmEdicao(agente); setEditModalOpen(true); };

  const agentesAtivosNoTurno = listaAgentes.filter(agente => agente.status_operacional !== 'Inativo');

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative overflow-hidden">
      
      {/* NOTIFICAÇÃO FLUTUANTE (TOAST) */}
      {notificacao && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-2xl border-l-4 flex items-start gap-4 transition-all duration-300 ${notificacao.tipo === 'sucesso' ? 'bg-white border-green-500' : notificacao.tipo === 'erro' ? 'bg-white border-red-500' : 'bg-white border-blue-500'}`}>
          <div className={`p-1 rounded-full ${notificacao.tipo === 'sucesso' ? 'bg-green-100 text-green-600' : notificacao.tipo === 'erro' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
            {notificacao.tipo === 'sucesso' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{notificacao.tipo === 'sucesso' ? 'Ação concluída' : notificacao.tipo === 'erro' ? 'Aviso do Sistema' : 'Informação'}</p>
            <p className="text-sm text-gray-500 mt-0.5">{notificacao.mensagem}</p>
          </div>
          <button onClick={() => setNotificacao(null)} className="text-gray-400 hover:text-gray-700 ml-2"><X size={18} /></button>
        </div>
      )}

      {/* MODAL GLOBAL DE CONFIRMAÇÃO (Substitui o window.confirm) */}
      {modalConfirmacao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[110] p-4 backdrop-blur-sm">
          <div className="bg-white p-8 rounded-xl w-full max-w-[400px] shadow-2xl relative text-center animate-scale-in">
            <div className="mx-auto bg-red-100 w-16 h-16 flex items-center justify-center rounded-full mb-4">
              <AlertCircle className="text-red-600" size={32} />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">{modalConfirmacao.titulo}</h2>
            <p className="text-gray-500 mb-8 text-sm">{modalConfirmacao.mensagem}</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setModalConfirmacao(null)} className="flex-1 px-4 py-2.5 font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">
                Cancelar
              </button>
              <button onClick={modalConfirmacao.acao} className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-md flex items-center justify-center gap-2">
                <Check size={18} /> Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm z-10 flex flex-col">
        <div className="flex justify-between items-center px-6 py-2 bg-gray-200 text-sm font-medium text-gray-700">
          <span> Higienópolis</span>
          <span> GABRIEL RODRIGUES</span>
        </div>
        
        <div className="bg-mackenzie text-white px-6 py-4 flex items-center justify-center relative">
          <div className="absolute left-6 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold">M</div>
          <h1 className="text-xl font-bold tracking-wide uppercase">PAINEL DE CONTROLE</h1>
        </div>

        <nav className="flex justify-center border-b border-gray-300 bg-white">
          <Link to="/" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold">
            <MapIcon size={24} /> MAPA
          </Link>
          <Link to="/agentes" className="flex flex-col items-center gap-1 px-8 py-4 text-mackenzie bg-red-50 border-b-4 border-mackenzie font-bold">
            <User size={24} /> AGENTES & DISPOSITIVOS
          </Link>
          <Link to="/ocorrencias" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold">
            <ShieldAlert size={24} /> OCORRÊNCIAS & RELATÓRIOS
          </Link>
          <Link to="#" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold">
            <Camera size={24} /> CÂMERAS
          </Link>
        </nav>
      </header>

      <main className="flex-1 p-8 max-w-[95%] mx-auto w-full">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white border-2 border-gray-300 rounded-xl p-6 flex items-center gap-6 shadow-sm">
            <User size={48} className="text-gray-700" />
            <div>
              <p className="text-gray-600 font-medium text-lg">Total de Agentes no Turno:</p>
              <p className="text-4xl font-bold text-gray-900">{agentesAtivosNoTurno.length}</p>
            </div>
          </div>
          <div className="bg-white border-2 border-gray-300 rounded-xl p-6 flex items-center gap-6 shadow-sm">
            <Smartphone size={48} className="text-gray-700" />
            <div>
              <p className="text-gray-600 font-medium text-lg">Total de Dispositivos Conectados:</p>
              <p className="text-4xl font-bold text-gray-900">{agentesAtivosNoTurno.filter(a => a.status_conexao === 'Online').length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 flex-wrap gap-4">
            <h2 className="text-xl font-bold text-gray-800 uppercase">AGENTES E DISPOSITIVOS ATIVOS NO TURNO</h2>
            <div className="flex items-center gap-3">
              <button onClick={() => setAgentModalOpen(true)} className="px-4 py-2 bg-mackenzie text-white hover:bg-red-800 transition rounded-lg font-bold flex items-center gap-2 shadow-sm">
                <Plus size={20} /> NOVO AGENTE
              </button>
              <button onClick={() => setTodosModalOpen(true)} className="px-4 py-2 border-2 border-gray-800 text-gray-800 hover:bg-gray-800 hover:text-white transition rounded-lg font-bold flex items-center gap-2">
                <Users size={20} /> Agentes Cadastrados
              </button>
              <div className="relative ml-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                <input type="text" placeholder="Buscar ativo..." className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-mackenzie disabled:bg-gray-100 disabled:cursor-not-allowed" disabled={agentesAtivosNoTurno.length === 0} />
              </div>
              <button className="p-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-100 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={agentesAtivosNoTurno.length === 0}>
                <SlidersHorizontal size={24} />
              </button>
            </div>
          </div>

          {carregando ? (
            <div className="flex justify-center py-12"><p className="text-gray-500 font-medium">Carregando agentes do banco de dados...</p></div>
          ) : agentesAtivosNoTurno.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-200 text-gray-700 text-xs font-bold uppercase border-b-2 border-gray-300">
                    <th className="px-4 py-3">Agente</th>
                    <th className="px-4 py-3">Matrícula</th>
                    <th className="px-4 py-3">Turno</th>
                    <th className="px-4 py-3">Bateria</th>
                    <th className="px-4 py-3">Conexão</th>
                    <th className="px-4 py-3">Status Operacional</th>
                    <th className="px-4 py-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-300">
                  {agentesAtivosNoTurno.map((agente) => (
                    <tr key={agente.id} onClick={() => abrirEdicao(agente)} className="hover:bg-gray-100 bg-white cursor-pointer transition" title="Clique para ver ou editar detalhes">
                      <td className="px-4 py-4 font-semibold text-gray-800">{agente.nome}</td>
                      <td className="px-4 py-4 text-gray-600">{agente.matricula}</td>
                      <td className="px-4 py-4 text-gray-600 capitalize">{agente.turno}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          <Battery size={18} className={agente.nivel_bateria <= 20 ? 'text-red-500' : 'text-green-500'} />
                          <span className="font-bold text-gray-700">{agente.nivel_bateria ? `${agente.nivel_bateria}%` : '--'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {agente.status_conexao === 'Online' ? <Wifi size={16} className="text-blue-500" /> : <WifiOff size={16} className="text-gray-400" />}
                          <span className={`text-sm font-bold ${agente.status_conexao === 'Online' ? 'text-blue-600' : 'text-gray-500'}`}>{agente.status_conexao || 'Offline'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-bold text-xs bg-green-100 text-green-800 border border-green-300`}>{agente.status_operacional}</span>
                      </td>
                      <td className="px-4 py-4 flex items-center justify-center gap-4">
                        <button onClick={(e) => handleAbrirChat(agente.nome, agente.matricula, e)} className="relative text-gray-500 hover:text-blue-600 transition" title="Rádio Tático / Chat">
                          <MessageSquare size={20} />
                          {mensagensNaoLidas[agente.matricula] && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-white"></span>
                            </span>
                          )}
                        </button>
                        <button onClick={(e) => handleNotificarAgente(agente.matricula, agente.nome, e)} className="text-gray-500 hover:text-yellow-600 transition" title="Notificar Agente na Rua"><Bell size={20} /></button>
                        <button onClick={(e) => handleDesconectarAgente(agente.matricula, agente.nome, e)} className="text-gray-500 hover:text-mackenzie transition" title="Desconectar da Ronda"><LogOut size={20} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 px-4 text-center bg-white">
              <div className="bg-gray-100 p-6 rounded-full mb-6"><FileText size={64} className="text-gray-400" /></div>
              <h3 className="text-2xl font-bold text-gray-700 mb-3">Nenhum agente ativo no turno no momento.</h3>
            </div>
          )}
        </div>
      </main>

      {/* --- SIDEBAR DO CHAT DA CENTRAL --- */}
      {isChatOpen && (
        <div className="fixed inset-0 z-40 flex justify-end bg-black bg-opacity-40 backdrop-blur-sm">
          <div className="w-full max-w-[450px] bg-gray-50 h-full flex flex-col shadow-2xl animate-slide-in-right">
            <div className="bg-white px-6 py-4 border-b border-gray-200 flex justify-between items-center shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-100 text-mackenzie rounded-full flex items-center justify-center font-bold">
                  <User size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-800">{agenteChatAtual}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Activity size={12} className={statusAntena.includes('Ligada') ? 'text-green-500' : 'text-red-500'} />
                    <span className={`text-[11px] font-bold ${statusAntena.includes('Ligada') ? 'text-green-600' : 'text-red-500'}`}>
                      {statusAntena}
                    </span>
                  </div>
                </div>
              </div>
              <button onClick={fecharChat} className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 p-2 rounded-full transition">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {mensagens.map((msg) => {
                const isCentral = msg.perfil === 'CENTRAL';
                return (
                  <div key={msg.id} className={`flex flex-col ${isCentral ? 'items-end' : 'items-start'}`}>
                    <span className="text-[10px] text-gray-400 font-bold mb-1 ml-1">
                      {isCentral ? 'PAINEL CENTRAL' : msg.remetente.toUpperCase()}
                    </span>
                    <div className={`max-w-[85%] px-4 py-3 rounded-2xl shadow-sm relative ${
                      isCentral ? 'bg-mackenzie text-white rounded-tr-sm' : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'
                    }`}>
                      <p className="text-sm leading-relaxed">{msg.mensagem}</p>
                      <span className={`text-[10px] block mt-1 text-right ${isCentral ? 'text-red-200' : 'text-gray-400'}`}>
                        {formatarHora(msg.created_at)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={mensagensFimRef} />
            </div>
            <div className="p-4 bg-white border-t border-gray-200">
              <div className="flex items-center bg-gray-100 rounded-full border border-gray-200 pr-2 pl-4 py-2 focus-within:ring-2 focus-within:ring-mackenzie transition-all">
                <input 
                  type="text" 
                  placeholder="Mensagem para a equipe..."
                  className="flex-1 bg-transparent text-sm text-gray-700 focus:outline-none"
                  value={novaMensagem}
                  onChange={(e) => setNovaMensagem(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') enviarMensagem() }}
                />
                <button 
                  onClick={enviarMensagem}
                  disabled={!novaMensagem.trim()}
                  className="w-10 h-10 bg-mackenzie text-white rounded-full flex items-center justify-center hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <Send size={18} className="ml-[-2px]" />
                </button>
              </div>
              <p className="text-center text-[10px] text-gray-400 mt-2">As mensagens são gravadas no servidor oficial.</p>
            </div>
          </div>
        </div>
      )}

      {/* MODAIS DE CADASTRO E EDIÇÃO ABAIXO (Inalterados) */}
      {isEditModalOpen && agenteEmEdicao && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[105] p-4">
          <div className="bg-white p-8 rounded-xl w-full max-w-[500px] shadow-2xl relative">
            <button onClick={() => setEditModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"><X size={24} /></button>
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Detalhes do Agente</h2>
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                <label className="w-24 h-24 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 text-gray-500 overflow-hidden relative transition">
                  {agenteEmEdicao.fotoPreview || agenteEmEdicao.foto_url ? <img src={agenteEmEdicao.fotoPreview || agenteEmEdicao.foto_url} alt="Preview" className="w-full h-full object-cover" /> : <> <Camera size={24} /> <span className="text-xs mt-1">Alterar</span> </>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) { setAgenteEmEdicao({...agenteEmEdicao, fotoPreview: URL.createObjectURL(e.target.files[0])}); } }} />
                </label>
              </div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Matrícula (Imutável)</label><input type="text" value={agenteEmEdicao.matricula} disabled className="w-full p-3 bg-gray-100 border border-gray-300 rounded-lg text-gray-500 cursor-not-allowed" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Nome Completo</label><input type="text" value={agenteEmEdicao.nome} onChange={(e) => setAgenteEmEdicao({...agenteEmEdicao, nome: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mackenzie" /></div>
              <div><label className="text-xs font-bold text-gray-500 uppercase">Turno Base</label><select value={agenteEmEdicao.turno || ''} onChange={(e) => setAgenteEmEdicao({...agenteEmEdicao, turno: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mackenzie"><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></div>
            </div>
            <div className="flex justify-between items-center mt-8 pt-4 border-t border-gray-200">
              <button onClick={handleExcluirAgente} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg font-bold transition"><Trash2 size={18} /> Excluir Cadastro</button>
              <div className="flex gap-3">
                <button onClick={() => setEditModalOpen(false)} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
                <button onClick={handleSalvarEdicao} className="px-4 py-2 bg-mackenzie text-white font-bold rounded-lg hover:bg-red-800">Salvar Dados</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CADASTRAR NOVO AGENTE (SEM O CAMPO DE E-MAIL!) */}
      {isAgentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[105] p-4">
          <div className="bg-white p-8 rounded-xl w-full max-w-[500px] shadow-2xl relative">
            <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-2">Cadastrar Novo Agente</h2>
            <div className="space-y-4">
              <div className="flex justify-center mb-4">
                <label className="w-24 h-24 bg-gray-200 rounded-full border-2 border-dashed border-gray-400 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 text-gray-500 overflow-hidden relative transition">
                  {fotoPreview ? <img src={fotoPreview} alt="Preview" className="w-full h-full object-cover" /> : <> <Camera size={24} /> <span className="text-xs mt-1">Foto</span> </>}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files && e.target.files[0]) { setFotoPreview(URL.createObjectURL(e.target.files[0])); } }} />
                </label>
              </div>
              <input type="text" placeholder="Nome Completo do Agente" value={nomeDigitado} onChange={(e) => setNomeDigitado(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mackenzie" />
              <input type="text" placeholder="Matrícula (Sem letras)" value={matriculaDigitada} onChange={(e) => setMatriculaDigitada(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mackenzie" />
              
              <select value={turnoSelecionado} onChange={(e) => setTurnoSelecionado(e.target.value)} className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-mackenzie text-gray-600">
                <option value="">Selecione o Turno</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 mt-8">
              <button onClick={() => setAgentModalOpen(false)} className="px-4 py-2 font-medium text-gray-600 hover:bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={handleSalvarAgente} className="px-4 py-2 bg-mackenzie text-white font-bold rounded-lg hover:bg-red-800">Salvar Agente</button>
            </div>
          </div>
        </div>
      )}

      {isTodosModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[105] p-4">
          <div className="bg-white p-6 rounded-xl w-full max-w-5xl shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
              <div><h2 className="text-2xl font-bold text-gray-800">Agentes Cadastrados</h2><p className="text-gray-500 text-sm mt-1">Clique para editar</p></div>
              <button onClick={() => setTodosModalOpen(false)} className="text-gray-500 hover:bg-gray-100 p-2 rounded-full transition"><X size={24} /></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-100 text-gray-600 text-xs font-bold uppercase border-b-2 border-gray-300">
                    <th className="px-4 py-3">Agente</th><th className="px-4 py-3">Matrícula</th><th className="px-4 py-3">Turno Padrão</th><th className="px-4 py-3">Status Operacional</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {listaAgentes.length > 0 ? listaAgentes.map((agente) => (
                    <tr key={agente.id} onClick={() => { setTodosModalOpen(false); abrirEdicao(agente); }} className="hover:bg-gray-100 cursor-pointer transition">
                      <td className="px-4 py-3 font-semibold text-gray-800">{agente.nome}</td>
                      <td className="px-4 py-3 text-gray-600">{agente.matricula}</td>
                      <td className="px-4 py-3 text-gray-600 capitalize">{agente.turno}</td>
                      <td className="px-4 py-3"><span className={`font-medium ${agente.status_operacional === 'Inativo' ? 'text-gray-500' : 'text-blue-600'}`}>{agente.status_operacional}</span></td>
                    </tr>
                  )) : (<tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Nenhum agente cadastrado.</td></tr>)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
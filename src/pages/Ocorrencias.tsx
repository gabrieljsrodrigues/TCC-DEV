import { 
  Activity, Calendar, Camera, CheckCircle, Clock, Download, 
  FileBarChart, FileDown, FileText, Map as MapIcon, 
  Mic, Search, ShieldAlert, User, X, Check, AlertCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import * as XLSX from 'xlsx';
import { supabase } from '../services/supabase';

// IMPORTAÇÃO DA LÓGICA SEPARADA E TIPOS
import { 
  gerarHTMLRelatorio, 
  formatarData, 
  formatarDataHora, 
  calcularTempoAtendimento,
  type DadosRelatorio 
} from './geradorRelatorios';

export default function Ocorrencias() {
  const [ocorrencias, setOcorrencias] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [now, setNow] = useState(Date.now()); 

  const [isReportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState<'patrulhas' | 'ocorrencias' | null>(null);
  
  // ESTADO DOS FILTROS DO MODAL
  const [reportConfig, setReportConfig] = useState({ 
    dataInicio: '', dataFim: '', formato: 'pdf', agente: '', tipo: '' 
  });

  const [ocorrenciaParaFechar, setOcorrenciaParaFechar] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [notificacao, setNotificacao] = useState<{tipo: 'sucesso' | 'erro' | 'info', mensagem: string} | null>(null);

  const mostrarNotificacao = (tipo: 'sucesso' | 'erro' | 'info', mensagem: string) => {
    setNotificacao({ tipo, mensagem });
    setTimeout(() => setNotificacao(null), 4000); 
  };

  useEffect(() => {
    carregarOcorrencias(false); // Primeira carga (mostra o "Carregando...")

    const channel = supabase.channel('mudancas-ocorrencias')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ocorrencias' }, () => {
        carregarOcorrencias(true); // Atualização silenciosa em Background (não pisca a tela)
      })
      .subscribe();
      
    const timerId = setInterval(() => setNow(Date.now()), 60000);
    return () => { supabase.removeChannel(channel); clearInterval(timerId); };
  }, []);

  // ADICIONAMOS O PARÂMETRO "emBackground" PARA NÃO PISCAR A TELA
  const carregarOcorrencias = async (emBackground = false) => {
    try {
      if (!emBackground) setCarregando(true);

      const { data, error } = await supabase.from('ocorrencias').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      
      // FILTRO DE BLINDAGEM: Remove as ocorrências "fantasmas" / não classificadas
      const ocorrenciasValidas = (data || []).filter(o => !o.tipo_alerta?.includes('PENDENTE_DEFINICAO'));
      
      setOcorrencias(ocorrenciasValidas);
    } catch (error) {
      console.error("Erro ao carregar:", error);
    } finally {
      if (!emBackground) setCarregando(false);
    }
  };

  const confirmarFechamento = async () => {
    if (!ocorrenciaParaFechar) return;
    try {
      await supabase.from('ocorrencias').update({ status: 'FECHADO', closed_at: new Date().toISOString() }).eq('id', ocorrenciaParaFechar);
      setOcorrenciaParaFechar(null);
      carregarOcorrencias(true); // Atualiza por trás sem piscar
      mostrarNotificacao('sucesso', 'Ocorrência encerrada e movida para o histórico.');
    } catch (error) {
      mostrarNotificacao('erro', 'Falha ao encerrar a ocorrência.');
    }
  };

  const kpiTotais = ocorrencias.length;
  const kpiAtivas = ocorrencias.filter(o => o.status !== 'FECHADO').length;
  const kpiFechadas = ocorrencias.filter(o => o.status === 'FECHADO').length;
  
  let kpiTMA = "—";
  const ocorrenciasComTempo = ocorrencias.filter(o => o.status === 'FECHADO' && o.closed_at);
  if (ocorrenciasComTempo.length > 0) {
    const totalMs = ocorrenciasComTempo.reduce((acc, oc) => acc + (new Date(oc.closed_at).getTime() - new Date(oc.created_at).getTime()), 0);
    const mediaMins = Math.floor((totalMs / ocorrenciasComTempo.length) / 60000);
    
    if (mediaMins < 60) {
      kpiTMA = `${mediaMins}m`; // Menos de 1 hora
    } else if (mediaMins < 1440) {
      kpiTMA = `${Math.floor(mediaMins / 60)}h ${mediaMins % 60}m`; // Entre 1h e 24h
    } else {
      const dias = Math.floor(mediaMins / 1440);
      const horas = Math.floor((mediaMins % 1440) / 60);
      kpiTMA = `${dias}d ${horas}h`; // Mais de 1 dia (Ex: 6d 21h)
    }
  }

  const getBadgeStyle = (status: string, prioridade: string = 'Média') => {
    if (status?.toUpperCase() === 'FECHADO') return 'bg-green-100 text-green-800 border-green-300';
    if (prioridade?.toUpperCase() === 'CRÍTICA' || prioridade?.toUpperCase() === 'ALTA') return 'bg-red-100 text-red-800 border-red-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  const calcularTempoAberto = (dataCriacao: string) => {
    const diffMins = Math.floor((now - new Date(dataCriacao).getTime()) / 60000);
    
    if (diffMins < 60) return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ${diffMins % 60}m`;
    
    const dias = Math.floor(diffMins / 1440);
    const horas = Math.floor((diffMins % 1440) / 60);
    return `${dias}d ${horas}h`;
  };

  const abrirModalRelatorio = (tipo: 'patrulhas' | 'ocorrencias') => {
    setReportType(tipo);
    setReportConfig({ dataInicio: '', dataFim: '', formato: 'pdf', agente: '', tipo: '' }); // Reseta filtros ao abrir
    setReportModalOpen(true);
  };

  const handleGerarRelatorio = async () => {
    let inicio = reportConfig.dataInicio;
    let fim = reportConfig.dataFim;
    if (!inicio || !fim) {
      const hoje = new Date();
      const trintaDiasAtras = new Date(); trintaDiasAtras.setDate(hoje.getDate() - 30);
      fim = fim || hoje.toISOString().split('T')[0];
      inicio = inicio || trintaDiasAtras.toISOString().split('T')[0];
    }

    setReportModalOpen(false);
    mostrarNotificacao('info', 'Processando informações...');

    try {
      const startObj = new Date(inicio + 'T00:00:00');
      const endObj = new Date(fim + 'T23:59:59.999');

      const tabelaAlvo = reportType === 'patrulhas' ? 'logs_ronda' : 'ocorrencias';
      let query = supabase.from(tabelaAlvo).select('*')
        .gte('created_at', startObj.toISOString())
        .lte('created_at', endObj.toISOString())
        .order('created_at', { ascending: false });

      if (reportType === 'patrulhas' && reportConfig.agente) {
        query = query.or(`agente.ilike.%${reportConfig.agente}%,colaborador.ilike.%${reportConfig.agente}%`);
      }
      if (reportType === 'ocorrencias' && reportConfig.tipo) {
        query = query.ilike('tipo_alerta', `%${reportConfig.tipo}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let dadosFinais = data || [];
      if (reportType === 'ocorrencias') {
        dadosFinais = dadosFinais.filter(o => !o.tipo_alerta?.includes('PENDENTE_DEFINICAO'));
      }

      if (!dadosFinais || (dadosFinais.length === 0 && reportType === 'patrulhas')) {
        mostrarNotificacao('erro', 'Nenhum dado encontrado com esses filtros.');
        return;
      }

      const dataStr = `${inicio}_a_${fim}`;
      const nomeArquivo = reportType === 'patrulhas' ? `Relatorio_Patrulhas_${dataStr}` : `Relatorio_Ocorrencias_${dataStr}`;

      if (reportConfig.formato === 'excel') {
        const worksheet = XLSX.utils.json_to_sheet(dadosFinais);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Dados");
        XLSX.writeFile(workbook, `${nomeArquivo}.xlsx`);
        mostrarNotificacao('sucesso', 'Planilha gerada com sucesso!');
      } else {
        const dadosMapeados: DadosRelatorio = {
          tipo: reportType!,
          dataInicio: formatarData(startObj.toISOString()),
          dataFim: formatarData(endObj.toISOString()),
          geradoEm: formatarDataHora(new Date().toISOString()),
          idRelatorio: `REL-${reportType === 'patrulhas' ? 'PAT' : 'OCO'}-${Date.now().toString().slice(-6)}`,
          
          totalAgentes: new Set(dadosFinais.map(d => d.agente || d.colaborador).filter(Boolean)).size,
          totalRegistros: reportType === 'patrulhas' ? dadosFinais.length : 0,
          totalPatrulhas: reportType === 'patrulhas' ? Math.max(1, Math.ceil(dadosFinais.length / 10)) : 0, 
          
          distanciaPercorrida: '—', 
          tempoTotal: '—',
          coberturaRota: -1, 

          agentes: Array.from(new Set(dadosFinais.map(d => d.agente || d.colaborador).filter(Boolean))).map(nome => ({
            nome: nome as string,
            registros: dadosFinais.filter(d => (d.agente || d.colaborador) === nome).length,
            distancia: '—', tempo: '—',
            ultimoRegistro: formatarDataHora(dadosFinais.find(d => (d.agente || d.colaborador) === nome)?.created_at || '')
          })),

          totalOcorrencias: reportType === 'ocorrencias' ? dadosFinais.length : 0,
          ocorrenciasAbertas: reportType === 'ocorrencias' ? dadosFinais.filter(d => d.status !== 'FECHADO').length : 0,
          ocorrenciasResolvidas: reportType === 'ocorrencias' ? dadosFinais.filter(d => d.status === 'FECHADO').length : 0,
          ocorrencias: reportType === 'ocorrencias' ? dadosFinais.map(oc => {
            const partes = oc.tipo_alerta ? oc.tipo_alerta.split(':') : ['Ocorrência', '—'];
            const categoria = partes[0].trim();
            const subCategoria = partes.length > 1 ? partes.slice(1).join(':').trim() : '—';
            
            return {
              id: String(oc.id || ''),
              horario: formatarDataHora(oc.created_at).split(' ')[1] || '—',
              data: formatarData(oc.created_at),
              titulo: categoria,
              local: oc.endereco_social || 'Não informado',
              prioridade: oc.tipo_alerta?.includes('Emergência') || oc.tipo_alerta?.includes('Roubo') ? 'Crítica' : 'Média',
              agente: oc.agente || 'Sistema Central',
              status: oc.status || 'ABERTO',
              descricao: subCategoria,
              acao: oc.status === 'FECHADO' ? 'Ocorrência resolvida.' : 'Aguardando tratativa.',
              tempoAtendimento: calcularTempoAtendimento(oc.created_at, oc.closed_at)
            };
          }) : [],
          
          registros: reportType === 'patrulhas' ? dadosFinais : []
        };

        const conteudoHTML = gerarHTMLRelatorio(dadosMapeados);
        const janelaImpressao = window.open('', '', 'width=1000,height=800');
        if (janelaImpressao) {
          janelaImpressao.document.write(`<title>${nomeArquivo}</title>` + conteudoHTML);
          janelaImpressao.document.close();
          janelaImpressao.focus();
          
          setTimeout(() => {
            mostrarNotificacao('sucesso', 'Documento PDF gerado com sucesso!');
          }, 500);
        } else {
          mostrarNotificacao('erro', 'Pop-up bloqueado. Permita a abertura de pop-ups.');
        }
      }
    } catch (err) {
      console.error(err);
      mostrarNotificacao('erro', 'Erro ao gerar arquivo.');
    }
  };

  const ocorrenciasFiltradas = ocorrencias.filter(o => {
    const isFechado = o.status === 'FECHADO';
    if (filtroStatus === 'ABERTO' && isFechado) return false;
    if (filtroStatus === 'FECHADO' && !isFechado) return false;
    if (filtroTipo && !o.tipo_alerta?.includes(filtroTipo)) return false;
    return (o.agente?.toLowerCase() || '').includes(busca.toLowerCase()) || (o.endereco_social?.toLowerCase() || '').includes(busca.toLowerCase());
  });

  const agentesUnicos = Array.from(new Set(ocorrencias.map(o => o.agente).filter(Boolean)));

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col relative">
      {notificacao && (
        <div className={`fixed top-6 right-6 z-[100] px-5 py-4 rounded-xl shadow-2xl border-l-4 flex items-start gap-4 transition-all duration-300 ${notificacao.tipo === 'sucesso' ? 'bg-white border-green-500' : 'bg-white border-red-500'}`}>
          <div className={`p-1 rounded-full ${notificacao.tipo === 'sucesso' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
            {notificacao.tipo === 'sucesso' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          </div>
          <div>
            <p className="font-bold text-gray-800 text-sm">{notificacao.tipo === 'sucesso' ? 'Ação concluída' : 'Aviso do Sistema'}</p>
            <p className="text-sm text-gray-500 mt-0.5">{notificacao.mensagem}</p>
          </div>
          <button onClick={() => setNotificacao(null)} className="text-gray-400 hover:text-gray-700 ml-2"><X size={18} /></button>
        </div>
      )}

      <header className="bg-white shadow-sm z-10 flex flex-col">
        <div className="flex justify-between items-center px-6 py-2 bg-gray-200 text-sm font-medium text-gray-700"><span>Higienópolis</span><span>GABRIEL RODRIGUES</span></div>
        <div className="bg-mackenzie text-white px-6 py-4 flex items-center justify-center relative"><div className="absolute left-6 w-8 h-8 rounded-full border-2 border-white flex items-center justify-center font-bold">M</div><h1 className="text-xl font-bold tracking-wide uppercase">PAINEL DE CONTROLE</h1></div>
        <nav className="flex justify-center border-b border-gray-300 bg-white">
          <Link to="/" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold"><MapIcon size={24} /> MAPA</Link>
          <Link to="/agentes" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold"><User size={24} /> AGENTES & DISPOSITIVOS</Link>
          <Link to="/ocorrencias" className="flex flex-col items-center gap-1 px-8 py-4 text-mackenzie bg-red-50 border-b-4 border-mackenzie font-bold"><ShieldAlert size={24} /> OCORRÊNCIAS & RELATÓRIOS</Link>
          <Link to="#" className="flex flex-col items-center gap-1 px-8 py-4 text-gray-500 hover:text-mackenzie hover:bg-gray-50 transition border-b-4 border-transparent font-semibold"><Camera size={24} /> CÂMERAS</Link>
        </nav>
      </header>

      <main className="flex-1 p-8 max-w-[98%] mx-auto w-full flex flex-col xl:flex-row gap-8">
        <div className="flex-1 flex flex-col gap-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 flex items-center gap-4 shadow-sm"><div className="bg-blue-100 p-3 rounded-lg text-blue-700"><FileText size={28} /></div><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Ocorrências Totais</p><p className="text-3xl font-black text-gray-800">{kpiTotais}</p></div></div>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 flex items-center gap-4 shadow-sm"><div className="bg-yellow-100 p-3 rounded-lg text-yellow-700"><Activity size={28} /></div><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Ocorrências Ativas</p><p className="text-3xl font-black text-gray-800">{kpiAtivas}</p></div></div>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 flex items-center gap-4 shadow-sm"><div className="bg-green-100 p-3 rounded-lg text-green-700"><CheckCircle size={28} /></div><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wide">Ocorrências Fechadas</p><p className="text-3xl font-black text-gray-800">{kpiFechadas}</p></div></div>
            <div className="bg-white border-2 border-gray-200 rounded-xl p-5 flex items-center gap-4 shadow-sm"><div className="bg-purple-100 p-3 rounded-lg text-purple-700"><Clock size={28} /></div><div><p className="text-gray-500 text-xs font-bold uppercase tracking-wide">TMA (Tempo Médio)</p><p className="text-3xl font-black text-gray-800">{kpiTMA}</p></div></div>
          </div>

          <div className="bg-white rounded-xl shadow-md border border-gray-200 flex-1 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center gap-4">
              <h2 className="text-lg font-bold text-gray-800 uppercase flex items-center gap-2"><ShieldAlert size={20} className="text-mackenzie" /> Controle de Chamados</h2>
              <div className="flex gap-3">
                <div className="relative"><Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} /><input type="text" placeholder="Buscar por agente ou local..." value={busca} onChange={e => setBusca(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" /></div>
                
                <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mackenzie">
                  <option value="">Todas as Categorias</option>
                  <option value="Segurança e Crimes">Segurança e Crimes</option>
                  <option value="Controle de Acesso">Controle de Acesso</option>
                  <option value="Saúde e Emergência">Saúde e Emergência</option>
                  <option value="Patrimônio e Estrutura">Patrimônio e Estrutura</option>
                  <option value="Trânsito e Área Externa">Trânsito e Área Externa</option>
                  <option value="Serviços e Apoio">Serviços e Apoio</option>
                </select>

                <select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="py-2 px-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-mackenzie"><option value="">Todos os Status</option><option value="ABERTO">Em Andamento</option><option value="FECHADO">Fechado</option></select>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {carregando ? <div className="p-10 text-center">Carregando...</div> : ocorrenciasFiltradas.length > 0 ? (
                <table className="w-full text-left border-collapse min-w-[800px]">
                  <thead><tr className="bg-gray-200 text-[11px] font-bold uppercase border-b-2 tracking-wider"><th className="px-4 py-3">Data/Hora</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Local</th><th className="px-4 py-3">Agente</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Ações</th></tr></thead>
                  <tbody className="divide-y">
                    {ocorrenciasFiltradas.map(oc => {
                      const prioridadeInferred = oc.tipo_alerta?.includes('Emergência') || oc.tipo_alerta?.includes('Roubo') ? 'Alta' : 'Média';
                      const badgeClass = getBadgeStyle(oc.status, prioridadeInferred);
                      const isFechado = oc.status?.toUpperCase() === 'FECHADO' || oc.status?.toUpperCase() === 'SOLUCIONADO';
                      const statusClean = isFechado ? 'FECHADO' : 'EM ANDAMENTO';
                      
                      const partes = oc.tipo_alerta ? oc.tipo_alerta.split(':') : ['Alerta', 'Sem descrição detalhada'];
                      const categoriaStr = partes[0].trim();
                      const subCategoriaStr = partes.length > 1 ? partes.slice(1).join(':').trim() : categoriaStr;

                      return (
                        <tr key={oc.id} className="hover:bg-gray-50 bg-white transition cursor-default">
                          <td className="px-4 py-4 text-sm text-gray-600 font-medium">
                            {new Date(oc.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                          </td>
                          <td className="px-4 py-4">
                            <p className="text-sm font-bold text-gray-800 truncate max-w-[250px]" title={categoriaStr}>{categoriaStr}</p>
                            <p className="text-xs text-gray-500 truncate max-w-[250px]">{subCategoriaStr}</p>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-700 truncate max-w-[200px]">
                            {oc.endereco_social || 'Local não identificado'}
                          </td>
                          <td className="px-4 py-4 text-sm font-semibold text-gray-700">
                            {oc.agente}
                          </td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex items-center px-2.5 py-1.5 rounded-full text-xs font-bold border ${badgeClass}`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current mr-2"></span>
                              {statusClean}
                              {!isFechado && (
                                <span className="ml-2 pl-2 border-l border-current opacity-80 flex items-center gap-1" title="Tempo aberto">
                                  <Clock size={10} /> {calcularTempoAberto(oc.created_at)}
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-4 flex justify-center gap-3">
                            {!isFechado && (
                              <button onClick={() => setOcorrenciaParaFechar(oc.id)} className="text-gray-400 hover:text-green-600 transition" title="Encerrar / Solucionar Chamado"><CheckCircle size={18} /></button>
                            )}
                            <button className="text-gray-400 hover:text-blue-600 transition" title="Ver Câmeras Próximas"><Camera size={18} /></button>
                            <button className="text-gray-400 hover:text-green-600 transition" title="Acionar Rádio (Voz)"><Mic size={18} /></button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : <div className="p-10 text-center">Nenhuma ocorrência.</div>}
            </div>
          </div>
        </div>

        <aside className="w-full xl:w-80 flex flex-col gap-6 shrink-0">
          <div className="bg-white rounded-xl shadow-md border border-gray-200 p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-200">
              <FileBarChart className="text-mackenzie" size={24} />
              <h2 className="text-lg font-bold text-gray-800 uppercase">Extração de Dados</h2>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              Gere relatórios operacionais detalhados. Escolha entre o histórico de rondas geolocalizadas ou o painel consolidado de incidentes.
            </p>

            <div className="flex flex-col gap-4">
              <button 
                onClick={() => abrirModalRelatorio('patrulhas')}
                className="w-full bg-gray-800 hover:bg-gray-900 text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition shadow-sm"
              >
                <MapIcon size={32} className="text-gray-300" />
                <span className="font-bold text-center">Relatório de Patrulhas</span>
              </button>

              <button 
                onClick={() => abrirModalRelatorio('ocorrencias')}
                className="w-full bg-mackenzie hover:bg-red-800 text-white rounded-xl p-4 flex flex-col items-center justify-center gap-2 transition shadow-sm"
              >
                <ShieldAlert size={32} className="text-red-300" />
                <span className="font-bold text-center">Relatório de Ocorrências</span>
              </button>
            </div>
          </div>
        </aside>
      </main>

      {/* MODAL FECHAR */}
      {ocorrenciaParaFechar && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl w-[400px] text-center">
            <h2 className="text-xl font-bold mb-6">Encerrar Chamado?</h2>
            <div className="flex gap-3">
              <button onClick={() => setOcorrenciaParaFechar(null)} className="flex-1 px-4 py-2 bg-gray-100 rounded-lg">Cancelar</button>
              <button onClick={confirmarFechamento} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg flex items-center justify-center gap-2"><Check size={18} /> Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL RELATÓRIO COM FILTROS */}
      {isReportModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-8 rounded-xl w-[450px] relative">
            <button onClick={() => setReportModalOpen(false)} className="absolute top-5 right-5 text-gray-400"><X size={24} /></button>
            <h2 className="text-xl font-bold mb-6">Exportar {reportType}</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><Calendar size={14}/> Início</label>
                <input type="date" value={reportConfig.dataInicio} onChange={e => setReportConfig({...reportConfig, dataInicio: e.target.value})} className="w-full p-2 border rounded text-sm" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1 mb-1"><Calendar size={14}/> Fim</label>
                <input type="date" value={reportConfig.dataFim} onChange={e => setReportConfig({...reportConfig, dataFim: e.target.value})} className="w-full p-2 border rounded text-sm" />
              </div>
            </div>

            {reportType === 'patrulhas' && (
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Agente (Opcional)</label>
                <input 
                  list="agentes-list"
                  type="text" 
                  placeholder="Ex: Gabriel Rodrigues" 
                  value={reportConfig.agente} 
                  onChange={e => setReportConfig({...reportConfig, agente: e.target.value})} 
                  className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-mackenzie" 
                />
                <datalist id="agentes-list">
                  {agentesUnicos.map((agenteNome, idx) => (
                    <option key={idx} value={agenteNome as string} />
                  ))}
                </datalist>
              </div>
            )}

            {reportType === 'ocorrencias' && (
              <div className="mt-4">
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">Tipo de Ocorrência (Opcional)</label>
                <select value={reportConfig.tipo} onChange={e => setReportConfig({...reportConfig, tipo: e.target.value})} className="w-full p-3 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-mackenzie">
                  <option value="">Todos os Tipos</option>
                  <option value="Segurança e Crimes">Segurança e Crimes</option>
                  <option value="Controle de Acesso">Controle de Acesso</option>
                  <option value="Saúde e Emergência">Saúde e Emergência</option>
                  <option value="Patrimônio e Estrutura">Patrimônio e Estrutura</option>
                  <option value="Trânsito e Área Externa">Trânsito e Área Externa</option>
                  <option value="Serviços e Apoio">Serviços e Apoio</option>
                </select>
              </div>
            )}

            <div className="flex gap-4 mb-8 mt-6">
              <label className={`flex-1 p-3 border-2 rounded-lg text-center cursor-pointer font-bold text-sm flex items-center justify-center gap-2 ${reportConfig.formato === 'pdf' ? 'border-mackenzie bg-red-50 text-mackenzie' : 'border-gray-200 text-gray-500'}`}>
                <input type="radio" className="hidden" checked={reportConfig.formato === 'pdf'} onChange={() => setReportConfig({...reportConfig, formato: 'pdf'})} />
                <FileDown size={18} /> Documento PDF
              </label>
              <label className={`flex-1 p-3 border-2 rounded-lg text-center cursor-pointer font-bold text-sm flex items-center justify-center gap-2 ${reportConfig.formato === 'excel' ? 'border-green-600 bg-green-50 text-green-700' : 'border-gray-200 text-gray-500'}`}>
                <input type="radio" className="hidden" checked={reportConfig.formato === 'excel'} onChange={() => setReportConfig({...reportConfig, formato: 'excel'})} />
                <FileBarChart size={18} /> Planilha Excel
              </label>
            </div>
            
            <button onClick={handleGerarRelatorio} className="w-full py-3 bg-mackenzie text-white font-bold rounded-lg flex items-center justify-center gap-2">
              <Download size={18} /> Baixar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
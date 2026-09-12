// ============================================================
// TIPOS E INTERFACES PARA O RELATÓRIO
// ============================================================
export type RegistroPatrulha = {
  id?: string;
  created_at: string;
  colaborador?: string;
  agente?: string;
  latitude?: number;
  longitude?: number;
  endereco_social?: string | null;
  pressao_hpa?: number | null;
  altitude_relativa?: number | null;
};

export type AgenteResumo = {
  nome: string;
  registros: number;
  distancia: string;
  tempo: string;
  ultimoRegistro: string;
};

export type Ocorrencia = {
  id: string;
  horario: string;
  data: string;
  titulo: string;
  local: string;
  prioridade: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  agente: string;
  status: string;
  descricao: string;
  acao: string;
  tempoAtendimento: string;
};

export type DadosRelatorio = {
  tipo: 'patrulhas' | 'ocorrencias';
  dataInicio: string;
  dataFim: string;
  geradoEm: string;
  idRelatorio: string;

  totalAgentes: number;
  totalRegistros: number;
  totalPatrulhas: number;
  distanciaPercorrida: string;
  tempoTotal: string;
  coberturaRota: number;

  agentes: AgenteResumo[];
  registros: RegistroPatrulha[];

  ocorrencias: Ocorrencia[];
  totalOcorrencias: number;
  ocorrenciasAbertas: number;
  ocorrenciasResolvidas: number;
};

// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================
export const formatarData = (data: string) => {
  if (!data) return '—';
  return new Date(data).toLocaleDateString('pt-BR');
};

export const formatarDataHora = (data: string) => {
  if (!data) return '—';
  return new Date(data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

export const escaparHTML = (valor: unknown) => {
  return String(valor ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

export const calcularTempoAtendimento = (inicio: string, fim?: string | null) => {
  if (!fim) return 'Em andamento';
  const diffMs = new Date(fim).getTime() - new Date(inicio).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return `${diffMins} min`;
  const h = Math.floor(diffMins / 60);
  const m = diffMins % 60;
  return `${h}h ${m}m`;
};

export const obterClassePrioridade = (prioridade: string) => {
  if (prioridade === 'Crítica') return 'critica';
  if (prioridade === 'Alta') return 'alta';
  if (prioridade === 'Média') return 'media';
  return 'baixa';
};

// ============================================================
// TEMPLATE CSS E MODO VISUALIZADOR DE PDF
// ============================================================
const renderCSS = () => `
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }

/* REGRAS PARA O MODO TELA (VISUALIZADOR PDF NATIVO) */
@media screen {
  body { background: #525659; padding-top: 80px; padding-bottom: 40px; display: flex; flex-direction: column; align-items: center; margin: 0; font-family: Arial, sans-serif; }
  .page { background: white; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border-radius: 2px; }
  .viewer-topbar { position: fixed; top: 0; left: 0; right: 0; height: 60px; background: #323639; display: flex; align-items: center; justify-content: flex-end; padding: 0 24px; z-index: 1000; box-shadow: 0 2px 6px rgba(0,0,0,0.4); gap: 12px; }
  .btn-action { background: transparent; color: #f1f1f1; border: 1px solid #7c7c7c; padding: 8px 16px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 13px; transition: 0.2s; }
  .btn-action:hover { background: #4a4a4a; }
  .btn-primary { background: #D71920; border-color: #D71920; color: white; }
  .btn-primary:hover { background: #B51218; border-color: #B51218; }
}

/* REGRAS PARA A IMPRESSÃO (ESCONDE A BARRA SUPERIOR E SOMBRAS) */
@media print {
  .no-print { display: none !important; }
  body { background: white; padding: 0; display: block; }
  .page { box-shadow: none; margin: 0; border-radius: 0; }
}

.page { width: 210mm; min-height: 297mm; padding: 18mm 17mm 16mm; position: relative; page-break-after: always; color: #171717; font-family: Arial, Helvetica, sans-serif; }
.page:last-child { page-break-after: auto; }
.header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #E5E7EB; padding-bottom: 12px; margin-bottom: 25px; }
.brand { display: flex; align-items: center; }
.logo { width: 38px; height: 38px; background: #D71920; border-radius: 9px; display: flex; align-items: center; justify-content: center; color: white; font-size: 20px; font-weight: 800; margin-right: 10px; }
.brand-name { font-size: 13px; font-weight: 700; }
.brand-subtitle { font-size: 10px; color: #64748B; margin-top: 2px; }
.report-code { font-size: 9px; color: #64748B; text-align: right; }
.eyebrow { color: #D71920; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 5px; }
h1 { font-size: 29px; margin: 0; line-height: 1.1; } h1 span { color: #D71920; }
h2 { font-size: 18px; margin: 0 0 14px; color: #171717; }
.cover-title { margin-top: 18px; }
.cover-period { margin-top: 13px; color: #475569; font-size: 12px; }
.cover-image { margin-top: 28px; height: 145px; border-radius: 14px; overflow: hidden; background: linear-gradient(120deg, #171717 0%, #334155 55%, #D71920 55%, #D71920 100%); position: relative; }
.cover-image::after { content: "MONITORAMENTO\\A MACKENZIE"; white-space: pre; position: absolute; right: 25px; bottom: 25px; color: rgba(255,255,255,.9); font-size: 22px; font-weight: 800; text-align: right; line-height: 1.1; }
.kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 9px; margin-top: 18px; }
.kpi-grid.six { grid-template-columns: repeat(3, 1fr); }
.kpi { border: 1px solid #E2E8F0; border-radius: 10px; padding: 13px; background: #FFFFFF; }
.kpi-label { color: #64748B; font-size: 9px; margin-top: 6px; }
.kpi-value { font-size: 20px; font-weight: 800; color: #171717; }
.section { margin-top: 22px; }
.box { border: 1px solid #E2E8F0; border-radius: 12px; padding: 15px; background: #FFFFFF; }
.summary { background: #F8FAFC; border-left: 4px solid #D71920; padding: 15px; border-radius: 8px; color: #475569; font-size: 11px; line-height: 1.6; }
table { width: 100%; border-collapse: collapse; font-size: 9px; }
thead { background: #B51218; color: white; }
th { padding: 9px 7px; text-align: left; font-weight: 700; }
td { padding: 8px 7px; border-bottom: 1px solid #E5E7EB; color: #475569; }
tbody tr:nth-child(even) { background: #F8FAFC; }
.incident { border: 1px solid #E2E8F0; border-radius: 10px; padding: 13px; margin-bottom: 10px; page-break-inside: avoid; }
.incident-header { display: flex; justify-content: space-between; align-items: center; }
.incident-title { font-size: 12px; font-weight: 800; }
.badge { padding: 4px 7px; border-radius: 20px; font-size: 8px; font-weight: 700; }
.badge.baixa { background: #ECFDF5; color: #15803D; } .badge.media { background: #FFF7ED; color: #C2410C; } .badge.alta { background: #FEF2F2; color: #DC2626; } .badge.critica { background: #450A0A; color: white; }
.incident-meta { color: #64748B; font-size: 9px; margin-top: 6px; }
.incident-description { margin-top: 8px; color: #475569; font-size: 10px; line-height: 1.5; }
.timeline { margin-top: 10px; border-left: 2px solid #E2E8F0; padding-left: 20px; }
.timeline-item { position: relative; margin-bottom: 20px; page-break-inside: avoid; }
.timeline-item::before { content: ""; position: absolute; width: 10px; height: 10px; border-radius: 50%; background: #D71920; left: -26px; top: 2px; border: 3px solid white; box-shadow: 0 0 0 1px #D71920; }
.timeline-time { color: #D71920; font-size: 10px; font-weight: 800; }
.timeline-title { font-size: 11px; font-weight: 700; margin-top: 3px; }
.no-map { height: 200px; border: 1px dashed #CBD5E1; border-radius: 12px; background: #F8FAFC; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: #64748B; }
.alert { padding: 12px 14px; border-radius: 9px; margin-top: 14px; background: #FFF7ED; border: 1px solid #FED7AA; color: #9A3412; font-size: 10px; line-height: 1.5; }
.success { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
.footer { position: absolute; bottom: 9mm; left: 17mm; right: 17mm; border-top: 1px solid #E5E7EB; padding-top: 7px; display: flex; justify-content: space-between; font-size: 8px; color: #94A3B8; }
</style>
`;

const renderTopbar = () => `
  <div class="no-print viewer-topbar">
    <button class="btn-action" onclick="window.print()">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
      Imprimir
    </button>
    <button class="btn-action btn-primary" onclick="alert('DICA: Na janela a seguir, certifique-se de que o Destino seja \\'Salvar como PDF\\' e confirme para baixar o arquivo.'); window.print();">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
      Baixar PDF
    </button>
  </div>
`;

const renderCabecalho = (dados: DadosRelatorio, tituloSecao: string) => `
  <div class="header">
    <div class="brand">
      <div class="logo">M</div>
      <div>
        <div class="brand-name">Monitoramento Mackenzie</div>
        <div class="brand-subtitle">Segurança Institucional</div>
      </div>
    </div>
    <div class="report-code">${tituloSecao}<br/>Nº ${dados.idRelatorio}<br/>Gerado em: ${dados.geradoEm}</div>
  </div>
`;

// ============================================================
// GERADOR: RELATÓRIO DE OCORRÊNCIAS (RF-OCO)
// ============================================================
const gerarOcorrenciasHTML = (dados: DadosRelatorio) => {
  const ocorrenciasCriticas = dados.ocorrencias.filter(o => o.prioridade === 'Crítica' || o.prioridade === 'Alta').length;
  const porTipo = dados.ocorrencias.reduce((acc, oc) => { acc[oc.titulo] = (acc[oc.titulo] || 0) + 1; return acc; }, {} as Record<string, number>);
  const porStatus = dados.ocorrencias.reduce((acc, oc) => { acc[oc.status] = (acc[oc.status] || 0) + 1; return acc; }, {} as Record<string, number>);

  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head><meta charset="UTF-8" />${renderCSS()}</head>
  <body>
    ${renderTopbar()}
    
    <div class="page">
      ${renderCabecalho(dados, 'RELATÓRIO DE OCORRÊNCIAS')}
      <div class="cover-title">
        <div class="eyebrow">Relatório Operacional</div>
        <h1>Histórico de <span>Ocorrências</span></h1>
        <div class="cover-period">Período: <strong>${dados.dataInicio}</strong> até <strong>${dados.dataFim}</strong></div>
      </div>
      <div class="cover-image"></div>
      
      <div class="section">
        <h2>Resumo Geral</h2>
        <div class="kpi-grid">
          <div class="kpi"><div class="kpi-value">${dados.totalOcorrencias}</div><div class="kpi-label">Total Registrado</div></div>
          <div class="kpi"><div class="kpi-value">${dados.ocorrenciasAbertas}</div><div class="kpi-label">Em Andamento</div></div>
          <div class="kpi"><div class="kpi-value">${dados.ocorrenciasResolvidas}</div><div class="kpi-label">Resolvidas</div></div>
          <div class="kpi"><div class="kpi-value" style="color:#DC2626">${ocorrenciasCriticas}</div><div class="kpi-label">Alta/Crítica</div></div>
        </div>
      </div>

      <div class="section">
        <h2>Distribuição por Status e Tipo</h2>
        <div class="box" style="display:flex; gap: 20px;">
          <table style="flex:1">
            <thead><tr><th>Status</th><th>Quantidade</th></tr></thead>
            <tbody>
              ${Object.entries(porStatus).length > 0 ? Object.entries(porStatus).map(([status, qtd]) => `<tr><td>${status}</td><td>${qtd}</td></tr>`).join('') : `<tr><td colspan="2">Nenhum dado</td></tr>`}
            </tbody>
          </table>
          <table style="flex:1">
            <thead><tr><th>Tipo de Ocorrência</th><th>Quantidade</th></tr></thead>
            <tbody>
              ${Object.entries(porTipo).length > 0 ? Object.entries(porTipo).map(([tipo, qtd]) => `<tr><td>${tipo}</td><td>${qtd}</td></tr>`).join('') : `<tr><td colspan="2">Nenhum dado</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="footer"><span>Monitoramento Mackenzie</span><span>Página 1</span></div>
    </div>

    <div class="page">
      ${renderCabecalho(dados, 'DETALHAMENTO')}
      <h2>Listagem de Ocorrências</h2>
      
      ${dados.ocorrencias.length === 0 
        ? `<div class="alert success"><strong>Nenhuma ocorrência foi registrada no período selecionado.</strong></div>` 
        : dados.ocorrencias.map(oc => `
          <div class="incident">
            <div class="incident-header">
              <div class="incident-title">${escaparHTML(oc.titulo)} <span style="color:#94A3B8; font-weight:normal;">#${oc.id.substring(0,8)}</span></div>
              <span class="badge ${obterClassePrioridade(oc.prioridade)}">${escaparHTML(oc.prioridade)}</span>
            </div>
            <div class="incident-meta">Registro: ${escaparHTML(oc.data)} às ${escaparHTML(oc.horario)} | Local: ${escaparHTML(oc.local)} | Agente: ${escaparHTML(oc.agente)}</div>
            <div class="incident-description">
              <strong>Relato:</strong> ${escaparHTML(oc.descricao)}<br/><br/>
              <strong>Tratativa:</strong> ${escaparHTML(oc.acao)}
            </div>
            <div style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center;">
              <span class="badge ${oc.status === 'FECHADO' ? 'baixa' : 'media'}">${escaparHTML(oc.status)}</span>
              <span style="font-size:9px; color:#64748B;">Tempo de Atendimento: <strong>${escaparHTML(oc.tempoAtendimento)}</strong></span>
            </div>
          </div>
        `).join('')
      }
      <div class="footer"><span>Monitoramento Mackenzie</span><span>Página 2</span></div>
    </div>
  </body>
  </html>
  `;
};

// ============================================================
// GERADOR: RELATÓRIO DE PATRULHAS (RF-PAT)
// ============================================================
const gerarPatrulhasHTML = (dados: DadosRelatorio) => {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head><meta charset="UTF-8" />${renderCSS()}</head>
  <body>
    ${renderTopbar()}

    <div class="page">
      ${renderCabecalho(dados, 'RELATÓRIO DE PATRULHAS')}
      <div class="cover-title">
        <div class="eyebrow">Relatório Operacional</div>
        <h1>Patrulhamento <span>Geolocalizado</span></h1>
        <div class="cover-period">Período: <strong>${dados.dataInicio}</strong> até <strong>${dados.dataFim}</strong></div>
      </div>
      <div class="cover-image"></div>
      
      <div class="section">
        <h2>Resumo da Operação</h2>
        <div class="kpi-grid six">
          <div class="kpi"><div class="kpi-value">${dados.totalPatrulhas}</div><div class="kpi-label">Patrulhas</div></div>
          <div class="kpi"><div class="kpi-value">${dados.totalAgentes}</div><div class="kpi-label">Agentes</div></div>
          <div class="kpi"><div class="kpi-value">${dados.totalRegistros}</div><div class="kpi-label">Registros GPS</div></div>
          <div class="kpi"><div class="kpi-value">${dados.distanciaPercorrida}</div><div class="kpi-label">Distância</div></div>
          <div class="kpi"><div class="kpi-value">${dados.tempoTotal}</div><div class="kpi-label">Tempo Total</div></div>
          <div class="kpi"><div class="kpi-value">${dados.coberturaRota !== -1 ? dados.coberturaRota + '%' : '—'}</div><div class="kpi-label">Cobertura</div></div>
        </div>
      </div>

      <div class="section">
        <h2>Resumo por Agente</h2>
        <div class="box">
          <table>
            <thead><tr><th>Agente</th><th>Registros GPS</th><th>Distância</th><th>Tempo</th><th>Último Registro</th></tr></thead>
            <tbody>
              ${dados.agentes.length > 0 ? dados.agentes.map(ag => `<tr><td><strong>${escaparHTML(ag.nome)}</strong></td><td>${ag.registros}</td><td>${ag.distancia}</td><td>${ag.tempo}</td><td>${escaparHTML(ag.ultimoRegistro)}</td></tr>`).join('') : `<tr><td colspan="5">Sem dados no período selecionado</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="footer"><span>Monitoramento Mackenzie</span><span>Página 1</span></div>
    </div>

    <div class="page">
      ${renderCabecalho(dados, 'DADOS TÉCNICOS')}
      
      <h2>Visualização de Percurso</h2>
      <div class="no-map">
        <div class="no-map-icon">⌖</div>
        <div class="no-map-title">Mapa Indisponível</div>
        <div class="no-map-text">O mapa fictício foi desabilitado. Os dados geográficos exatos permanecem disponíveis abaixo.</div>
      </div>

      <div class="section">
        <h2>Detalhamento dos Registros de GPS</h2>
        <div class="box">
          <table>
            <thead><tr><th>Data/Hora</th><th>Agente</th><th>Local / Endereço</th><th>Lat/Lng</th><th>Altitude</th></tr></thead>
            <tbody>
              ${dados.registros.length > 0 ? dados.registros.slice(0, 40).map(reg => `
                <tr>
                  <td>${formatarDataHora(reg.created_at)}</td>
                  <td>${escaparHTML(reg.colaborador || reg.agente || '—')}</td>
                  <td>${escaparHTML(reg.endereco_social || '—')}</td>
                  <td>${reg.latitude ? `${reg.latitude.toFixed(5)}, ${reg.longitude?.toFixed(5)}` : '—'}</td>
                  <td>${reg.altitude_relativa != null ? reg.altitude_relativa.toFixed(1) + ' m' : '—'}</td>
                </tr>
              `).join('') : `<tr><td colspan="5">Nenhum registro encontrado.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
      <div class="alert"><strong>Aviso:</strong> Valores não capturados pelo dispositivo foram substituídos por traço ("—"). Não há uso de valores fictícios.</div>
      <div class="footer"><span>Monitoramento Mackenzie</span><span>Página 2</span></div>
    </div>
  </body>
  </html>
  `;
};

// ============================================================
// EXPORTAÇÃO PRINCIPAL
// ============================================================
export const gerarHTMLRelatorio = (dados: DadosRelatorio) => {
  if (dados.tipo === 'ocorrencias') {
    return gerarOcorrenciasHTML(dados);
  }
  return gerarPatrulhasHTML(dados);
};
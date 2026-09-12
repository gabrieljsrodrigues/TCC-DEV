import { supabase } from './supabase';

export interface NovoAgente {
  nome: string;
  matricula: string;
  turno: string;
}

export const agentesService = {
  
  async cadastrarAgente(agente: NovoAgente) {
    const emailAutomatico = `${agente.matricula.trim()}@seguranca.local`;

    const { data, error } = await supabase
      .from('agentes_autorizados')
      .insert([
        {
          nome: agente.nome,
          matricula: agente.matricula,
          turno: agente.turno,
          email_pessoal: emailAutomatico,
          status: 'AGUARDANDO_SENHA', 
          status_operacional: 'Inativo'
        }
      ])
      .select();

    if (error) {
      console.error("Erro no Supabase ao cadastrar agente:", error.message);
      throw error;
    }

    return data;
  },

  // NOVA FUNÇÃO: Busca todo mundo que está no banco
  async listarAgentes() {
    const { data, error } = await supabase
      .from('agentes_autorizados')
      .select('*')
      .order('id', { ascending: false }); // Traz os mais recentes primeiro

    if (error) {
      console.error("Erro ao buscar agentes:", error.message);
      throw error;
    }

    return data;
  }
};
// Tela "Novidades": aparece uma única vez para quem já tinha conta quando sai uma versão nova
// (no app e no site). Quem cria conta nova não vê: vê as boas-vindas e a primeira nota guiada.
//
// Na próxima versão, mude só o NOVIDADES abaixo: um id novo e a lista de itens.
// O id fica guardado na conta (e no aparelho), então cada pessoa vê cada versão uma vez só.
// Para não mostrar nada numa versão, deixe "itens" vazio.
import { cloud } from "./cloud";

/** Desenhos disponíveis para os itens (ficam em src/overlays/Novidades.tsx). */
export type NovIcone =
  | "visual"
  | "baralho"
  | "porque"
  | "diario"
  | "meia"
  | "tempo"
  | "semfim"
  | "estrela"
  | "curtir"
  | "spoiler"
  | "pessoas"
  | "javi"
  | "dado"
  | "grafico"
  | "sofa";

export interface Novidade {
  icone: NovIcone;
  titulo: string;
  texto: string;
}

export const NOVIDADES: {
  id: string;
  titulo: string;
  subtitulo?: string;
  botao: string;
  itens: Novidade[];
} = {
  id: "2.2.0", // só um nome para saber quem já viu; não aparece na tela
  titulo: "Novidades da 2.2",
  subtitulo: "Mais filmes com os seus amigos",
  botao: "Bora",
  itens: [
    {
      icone: "pessoas",
      titulo: "Filmes dos amigos",
      texto: "No perfil de um amigo, toque em Filmes e veja tudo o que ele viu e avaliou.",
    },
    {
      icone: "grafico",
      titulo: "Seu 2026",
      texto: "No seu perfil: crie uma meta de filmes e veja seu ano em números.",
    },
    {
      icone: "sofa",
      titulo: "Com quem você viu?",
      texto: "Ao dar a nota, marque os amigos que assistiram com você, até em casa.",
    },
  ],
};

const KEY = "lantNovidades";
const local = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

export const novidades = {
  /** Tem novidade que esta conta ainda não viu */
  due(): boolean {
    if (!NOVIDADES.itens.length) return false;
    if (local() === NOVIDADES.id) return false;
    return cloud.accountData().novidades !== NOVIDADES.id;
  },
  /** Marca como vista no aparelho e na conta (vale para o app e para o site) */
  seen() {
    try {
      localStorage.setItem(KEY, NOVIDADES.id);
    } catch {
      /* modo privado */
    }
    cloud.saveAccountData({ novidades: NOVIDADES.id });
  },
  /** Conta nova: já nasce com a versão atual vista */
  forNewAccount(): Record<string, string> {
    try {
      localStorage.setItem(KEY, NOVIDADES.id);
    } catch {
      /* ok */
    }
    return { novidades: NOVIDADES.id };
  },
};

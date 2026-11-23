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
  | "spoiler";

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
  id: "reviews", // só um nome para saber quem já viu; não aparece na tela
  titulo: "Novidades nas reviews",
  subtitulo: "A pedido de vocês...",
  botao: "Bora",
  itens: [
    {
      icone: "curtir",
      titulo: "Curtir review",
      texto: "Gostou do que um amigo escreveu? Toque no coração.",
    },
    {
      icone: "spoiler",
      titulo: "Tem spoiler",
      texto: "Marque, e a review fica borrada para quem não viu.",
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

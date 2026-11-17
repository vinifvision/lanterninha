<p align="center">
  <img src="public/logo.svg" width="112" alt="Logo do Lanterninha">
</p>

<h1 align="center">Lanterninha</h1>

<p align="center">
  Um app social de cinema para dar nota a filmes pela experiência, não pela técnica.
  <br>
  <a href="https://lanterninha.vercel.app"><b>lanterninha.vercel.app</b></a>
</p>

<p align="center">
  <img alt="React" src="https://img.shields.io/badge/React-18-20232a?logo=react&logoColor=61dafb">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-5-646cff?logo=vite&logoColor=white">
  <img alt="Supabase" src="https://img.shields.io/badge/Supabase-Auth%20%2B%20Postgres-3ecf8e?logo=supabase&logoColor=white">
  <img alt="Capacitor" src="https://img.shields.io/badge/Capacitor-Android-119eff?logo=capacitor&logoColor=white">
  <img alt="Vercel" src="https://img.shields.io/badge/Vercel-deploy-000?logo=vercel">
</p>

---

## O problema

Quem está começando a ver cinema com mais atenção trava na hora de dar nota. Avaliar roteiro, direção e fotografia separadamente exige um repertório que a maioria das pessoas ainda não tem. E filmes clássicos pesam ainda mais: é difícil separar o que você sentiu da fama que o filme carrega.

## A solução

O Lanterninha troca a pergunta "o filme é bom?" por **"como foi para você?"**. São sete perguntas rápidas sobre a experiência, uma por tela, e no final sai uma sugestão de ½ a 5 estrelas, que a pessoa pode ajustar.

Em volta disso, o app virou um espaço para um grupo de amigos acompanhar o que cada um está vendo.

## Funcionalidades

**Avaliação**
- Sete perguntas com cinco opções equilibradas, cada uma com peso diferente no cálculo
- Modo **clássico**, que ajuda a separar a experiência pessoal do status do filme
- Modo **reassistir**, que compara a nota de antes com a de agora
- Comparação final com um filme de nota parecida que você já avaliou
- Revelação da nota com animação de projetor e efeitos sonoros gerados em tempo real (Web Audio)

**Filmes**
- Busca com pôster, título original e ano (TMDB)
- Página do filme com banner, trailer, sinopse, elenco e onde assistir no Brasil
- Fundo da página tingido com a cor dominante do pôster
- Três estados: **Quero ver → Já vi → Avaliado**
- Diário agrupado por mês, filtros por nota e busca
- Reviews com editor próprio
- Imagem para compartilhar nos formatos post e story, gerada em canvas

**Social**
- Contas, perfil com foto, bio e filmes favoritos
- Amizades por pedido e aceite
- **Nota da galera**: as notas dos amigos para o mesmo filme
- **Indicações** de filmes entre amigos
- **Palpite**: um jogo para adivinhar a nota que o amigo deu, com placar

**Plataforma**
- Funciona offline primeiro (local-first) e sincroniza com a conta por diferença
- App Android nativo via Capacitor, com atualização automática a cada deploy
- Versão web instalável (PWA) para iPhone

## Decisões técnicas

| Decisão | Por quê |
| --- | --- |
| **Chave do TMDB só no servidor** | As chamadas passam por funções serverless na Vercel (`/api`), então a chave nunca chega ao navegador. |
| **Segurança no banco, não no front** | Row Level Security no Postgres: cada pessoa só lê e escreve o que é dela ou o que os amigos compartilham. Funções `security definer` cuidam de amizade e pontuação. |
| **Dados sanitizados na entrada** | Tudo que vem da API, do banco ou de backup passa por funções de limpeza antes de ser exibido, para evitar XSS. |
| **Local-first com sincronização por hash** | O app responde na hora, mesmo sem internet. Só o que mudou é enviado, comparando um hash de cada filme. |
| **App Android carregando o site publicado** | Uma única base de código para web e Android, e os amigos recebem as atualizações sem reinstalar. |
| **Sem framework de estado** | O estado global é pequeno. Lojas simples com `useSyncExternalStore` resolvem sem dependências extras. |

## Stack

- **Front-end:** React 18, TypeScript (modo estrito), Vite
- **Back-end:** Supabase (Auth, Postgres, RLS) e funções serverless na Vercel
- **Mobile:** Capacitor (Android)
- **Dados de filmes:** API do TMDB e disponibilidade em streaming via JustWatch
- **Testes:** testes de ponta a ponta com Playwright e um cliente Supabase simulado

## Como rodar

```bash
npm install
npm run dev
```

A busca de filmes usa as funções do site publicado, então o projeto roda sem configurar nenhuma chave.

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Ambiente de desenvolvimento |
| `npm run build` | Checa os tipos e gera a versão final em `dist` |
| `npm run android` | Gera o build e abre o projeto Android no Android Studio |

## Estrutura

```
api/          Funções serverless: busca, detalhes do filme e proxy de imagens
android/      Projeto nativo gerado pelo Capacitor
public/       Ícones e manifesto do PWA
src/
  lib/        Regras de negócio e dados, sem interface
  components/ Peças reutilizáveis (estrelas, pôster, avatar…)
  screens/    Telas principais
  overlays/   Telas que abrem por cima (reviews, configurações, palpite…)
  nav.ts      Navegação entre abas, telas e sobreposições
  styles/     Estilos
```

## Próximos passos

- Tela inicial com a atividade recente dos amigos e recomendações
- Importação do histórico do Letterboxd
- Retrospectiva do ano, individual e do grupo
- Notificações

## Autor

Feito por **Vinícius Fernandes**, estudante de Análise e Desenvolvimento de Sistemas no Senac Pernambuco.

[GitHub](https://github.com/vinifvision)

---

© 2026 Vinícius Fernandes. Todos os direitos reservados. Este código está público para fins de portfólio. Não é permitido copiar, redistribuir ou usar o projeto sem autorização.

Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB. Dados de disponibilidade em streaming fornecidos pela JustWatch.

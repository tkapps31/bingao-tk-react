# 🎉 Bingão do TK

App de Bingo em tempo real com **React + Supabase**.

---

## Pré-requisitos

- Node.js 18+
- Projeto no [Supabase](https://supabase.com)

---

## Setup

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar o banco de dados

Execute o arquivo `supabase-schema.sql` no **SQL Editor** do seu projeto Supabase.

### 3. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha com suas credenciais:

```bash
cp .env.example .env
```

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...
```

As credenciais ficam em **Settings → API** no dashboard do Supabase.

### 4. Rodar em desenvolvimento

```bash
npm run dev
```

### 5. Build para produção

```bash
npm run build
```

---

## Estrutura do projeto

```
bingao-do-tk/
├── App.jsx               ← Componente raiz + toda a lógica
├── index.html            ← Entry point HTML
├── vite.config.js        ← Configuração do Vite
├── package.json
├── .env.example          ← Template de variáveis de ambiente
├── supabase-schema.sql   ← Schema do banco (execute no Supabase)
└── src/
    └── main.jsx          ← Ponto de entrada React
```

---

## Como usar

### Host 🎤
1. Toque em **Sou o Host**
2. Compartilhe o QR Code ou código da sala com os jogadores
3. Aguarde os jogadores entrarem e toque em **Iniciar Partida**
4. Chame os números manualmente ou ative o **Modo Automático**
5. Ao receber alerta de BINGO, confirme ou rejeite

### Jogador 🎮
1. Toque em **Sou Jogador**
2. Digite o código da sala ou escaneie o QR Code
3. Escolha a quantidade de cartelas (1–5)
4. Aguarde o Host iniciar — os números são marcados automaticamente!

---

## Stack

| Tecnologia | Uso |
|---|---|
| React 18 | Interface |
| Vite | Bundler |
| Supabase JS v2 | Banco + Realtime WebSockets |

## Tabelas Supabase

| Tabela | Descrição |
|---|---|
| `rooms` | Salas de bingo (código, fase, números chamados) |
| `players` | Jogadores e suas cartelas (JSONB) |
| `room_events` | Eventos em tempo real (bingo, início, fim) |

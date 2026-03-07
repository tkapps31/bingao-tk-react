# Documentação: Bingão do TK

Esta é uma visão detalhada do funcionamento interno do aplicativo "Bingão do TK", um jogo de Bingo em tempo real (multiplayer) construído com **React**, **Vite** e **Supabase**.

---

## 🏗️ Estrutura Geral do Projeto
O projeto foi desenvolvido como uma Single Page Application (SPA), onde a maior parte de sua lógica e interface do usuário está concentrada em um único arquivo raiz: `App.jsx`. O projeto é empacotado pelo **Vite**.

*   **`App.jsx`**: O coração do aplicativo. Engloba as funções utilitárias do jogo, geração de cartelas, verificação de vitória (BINGO), interface e conexão com o banco de dados via WebSocket.
*   **`supabase-schema.sql`**: Script de banco de dados usado para gerar as tabelas e políticas de Row Level Security (RLS) necessárias no Supabase.
*   **Pacotes Supabase**: Utiliza `@supabase/supabase-js` para criar o cliente do banco de dados e garantir a reatividade no front-end.

---

## 🗄️ Esquema de Banco de Dados (Supabase)

A aplicação tira grande proveito das facilidades Realtime do Postgres fornecidas pelo Supabase. O banco de dados consiste em três tabelas principais:

1.  **`rooms` (Salas)**
    *   Gerencia o estado da partida. Recebe um código único (`code`) de 5 caracteres.
    *   Armazena a fase atal (`waiting`, `running`, `paused`, `ended`), os números já chamados (`called_numbers`), número atual, configurações do Host (ex: linguagem do locutor e tipo de verificação de BINGO) e quem foi o jogador vencedor.
2.  **`players` (Jogadores)**
    *   Pertence a uma Room (`room_id`).
    *   Guarda o nome do jogador, bem como as dezenas e o estado de todas as suas cartelas criadas na sessão (`cards` em formato `JSONB`).
    *   Possui a chave booleana `has_bingo` determinando se o jogador venceu, e `is_host` para identificar o criador da sala.
3.  **`room_events` (Eventos da Sala)**
    *   Ferramenta assíncrona para notificar as pontas sobre ações essenciais, como `game_started`, `game_ended`, e notificar o Host de que alguém fez BINGO (`bingo_claim`).

> **Nota de Segurança:** O esquema utiliza RLS liberado (Políticas `FOR ALL USING (true)`) intencionalmente, priorizando a facilidade da ausência de login durante a jogatina, tratando-se de um sistema confiável baseado no código da sessão.

---

## ⚙️ Lógica do Jogo e Componentes (App.jsx)

### Funções Core de Bingo (Lógica Sem Interface)
*   `generateCard()`: Constroi aleatoriamente uma nova cartela distribuindo os números em 5 colunas (*B, I, N, G, O*). A casa do meio ("N") já vem grátis preenchida.
*   `markCardNum()`: Recebe uma cartela e um número que foi sorteado. Se a cartela tiver esse número, ele o marca em uma matriz auxiliar `*_m` (ex: `B_m`, `I_m`), recriando o objeto da cartela para alimentar o estado do React.
*   `checkBingo()`: Função recursiva que avalia o cenário atual da cartela para validar a condição de vitória definida na Sala. Estuda 3 tipos: Linha/Coluna (`line`), Diagonal (`diagonal`) ou Cartela Cheia (`full`).

### Interface (Componentes React)

1.  **`SplashScreen`**
    A tela inicial da aplicação. Apresenta o aplicativo ao usuário com um visual atrativo renderizando as letras do jogo em balões flutuantes. Aqui, o cliente tem acesso aos caminhos divergentes: **Criar e controlar uma Sala (Host)** ou **Entrar em uma Sala (Jogador)**.
2.  **`HostScreen`**
    Um painel de comando para o "apresentador e dono do bingo". 
    * O componente dispara a inserção de uma Room no DB assim que lido, gerando um código (ex: `H8L3V`) ou um QR code (via Canvas API manual `drawQR()`).
    * Inscreve-se (`subscribe`) via Websockets nos canais `host_players_*` e `host_events_*` para ficar vigiando a tabela `players` e ver quem entrou, e a tabela `events` para receber gritos de Bingo em tempo real.
    * Controla opções de acessibilidade: Velocidade do Ditado Automático, Língua do Áudio, e o Estilo (Festivo, Rápido, Tradicional) que afeta como a SpeechSynthesis do navegador grita o número que saiu na "BigBall".
3.  **`JoinScreen`**
    Tela em que o Jogador comum digita o código (com validação anti-minúsculas), escolhe seu visual (apelido), e escolhe as opções do bingo. Ao entrar, o componente insere o Jogador na tabela `players` com um `JSONB` de 1 até 5 cartelas preenchidas.
4.  **`PlayerScreen`**
    A mágica da sincronização acontece aqui via um canal real-time chamado `player_room_*` na tabela `rooms` para ouvir todas as mudanças realizadas pela bola cantada do Host. O client do componente `PlayerScreen` reescreve localmente suas cartelas com a função `markCardNum()` assim que percebe que a aba de números sorteados na Sala recebeu inserções novas. 
    * Se dectetar um bingo com sua cartela, mostra o efeito dramático com confetes via componente de sobreposição `WinOverlay`, e envia um evento falso para comunicar ao host.
5.  **Componentes Gráficos Customizados**
    *   **CSS em JS Constante (`CSS` / `useCSS`):** Utiliza uma estratégia de inject de Styles via JS que constroi dezenas de animações `keyframes` (bounce, pop, float) que respondem à marcações. 
    *   **Toast Alert (`useToast`):** Substituto moderno ao humilde `window.alert()`, injetando alertas responsivos.

### Web Speech API
O código provê acessibilidade aprimorada com a utilização inteligente da interface Web interna `window.speechSynthesis`, capaz de proferir as "bolinhas sorteadas" com sintaxe dependente da língua, estilo (tradução para texto puro de incentivo como "Isso aí!") e ritmo do host selecionado.

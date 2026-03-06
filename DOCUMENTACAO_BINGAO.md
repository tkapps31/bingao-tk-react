# Documentação do Código: Bingão do TK

Esta documentação fornece uma visão geral detalhada da arquitetura, estrutura de arquivos e lógica de funcionamento da aplicação **Bingão do TK**, baseada em React e Supabase.

## 1. Visão Geral da Arquitetura

O **Bingão do TK** é uma aplicação web de Bingo em tempo real (realtime) construída como uma *Single Page Application* (SPA). A stack tecnológica é composta por:

- **Frontend:** React 18 empacotado através do Vite. Funciona em uma estrutura puramente do lado do cliente.
- **Backend/Database:** Supabase, utilizando o banco de dados PostgreSQL embarcado e seus recursos de *Realtime WebSockets* para atualizações instantâneas entre host e jogadores.
- **Acessibilidade:** Uso da API nativa de `SpeechSynthesis` do navegador para cantar os números sorteados em áudio de forma automatizada.

O projeto adotou um formato focado na simplicidade de deploy e concentração de código. Quase toda a lógica principal, estados da aplicação e componentes de UI encontram-se estruturados em um único arquivo raiz: `App.jsx`.

---

## 2. Estrutura do Banco de Dados (Supabase)

O esquema do banco (`supabase-schema.sql`) é composto por 3 tabelas principais, contendo políticas abertas (*Row Level Security* com acesso público garantido) já que não exige sistema de login ou autenticação complexa:

1. **`rooms` (Salas):** 
   - Armazena as sessões ativas do jogo.
   - Guardar o array de `called_numbers` (números já sorteados).
   - Guarda o `win_pattern` (linha, cartela cheia, diagonal).
   - Controla a fase do jogo (`waiting`, `running`, `paused`, `ended`), assim como referências em caso de vitória (`winner_player_id`).

2. **`players` (Jogadores):**
   - Vinculado a uma sala (`room_id`).
   - Salva os cartões (`cards` em formato JSONB) que pertencem àquele usuário, permitindo ter entre 1 e 5 cartelas.
   - Possui flags para determinar se o jogador é o Host (`is_host`) ou se gritou Bingo (`has_bingo`).

3. **`room_events` (Eventos):**
   - Funciona como um *log de ações em tempo real*. É a principal forma de comunicação passiva entre os clientes via *Supabase Realtime*.
   - Tipos de eventos registrados: `bingo_claim` (pediu bingo), `bingo_confirmed` (verificado e aceito), `bingo_rejected` (bingo falso), `game_started` e `game_ended`.

---

## 3. Estrutura e Lógica Principal (`App.jsx`)

Como mencionado, a maior parte do código reside no `src/App.jsx`. O arquivo possui aproximadamente 1100 linhas e é dividido de forma bem estruturada, contendo as seguintes macros:

### 3.1. Funções Utilitárias e de Regras do Jogo
- **`generateCard()` / `markCardNum()` / `isMk()`:** Lógica clássica de gerar matrizes 5x5 de Bingo contendo as colunas correspondentes (B 1-15, I 16-30, N 31-45, G 46-60, O 61-75) e um espaço em branco no centro (tradicionalmente "Free Space").
- **`checkBingo()`:** O algoritmo de validação que verifica se a matriz de uma cartela preenche os requisitos estipulados de vitória (Linha, Coluna, Diagonal ou Cartela Cheia).

### 3.2. Mecânica de "Voz" (Text-to-Speech)
- **`speakRaw()` / `speakNumber()`:** Funções adaptadas para capturar vozes configuradas do navegador e "cantar" os números. A aplicação tenta simular o comportamento de um locutor de Bingo.

### 3.3. Estilos Injectados
- **`useCSS()`:** Injeta via *tag style* diretrizes globais do CSS ao carregar a aplicação, com animações ricas (ex: as "bolas pulando" `ballpop`, animações modais `chipin`) garantindo que as dependências externas de design sejam nulas. Elementos usam variáveis CSS e animações *keyframes* de alta velocidade.

### 3.4. Componentes de UI Modulares
- Componentes funcionais reaproveitáveis renderizando modais e alertas:
  - **`Toast` e `useToast`**: Sistema customizado para exibir notificações push na tela (snackbars).
  - **`MiniBall` / `BigBall`**: Renderização estilizada de números e esferas de sorteio.
  - **`SplashScreen`**: Tela inicial, perguntando ao usuário se ele deseja *Criar uma Sala* ou _Entrar como Jogador_.
  - **`QRModal` / `BingoAlert` / `WinOverlay`**: Telas de avisos dinâmicas e compartilhamento de sala.
  - **`Cartela`**: Renderização visual da tabela CSS que representa as marcações de números.

### 3.5. Telas Principais da Aplicação

1. **`HostScreen` (A Tela do Locutor / Dono da Sala):**
   - Cria o registro no DB na tabela `rooms`.
   - Pode compartilhar via QRCode (usando lógica direta do Canvas via `drawQR`).
   - Lida com o progresso do jogo: Chama novos números iterando pelo pool que ainda não saíram, faz controle temporizado no modo Auto.
   - Faz a verificação imperativa (`checkAllCards`) de todos os jogadores ativos para descobrir se há algum ganhador ou reage em cima dos alertas assíncronos que chegam por websockets na tabela `room_events`.

2. **`JoinScreen` (A Tela de Entrada):**
   - Formulário simples que interage buscando o ID de uma sala pelo código de texto.

3. **`PlayerScreen` (A Tela do Jogador Competidor):**
   - Escuta em "Live-Subscribe" no Supabase e recebe a lista global `called_numbers`.
   - O jogador acompanha as próprias cartelas em tempo real. Pelo README há um indicativo que a validação de marcação (`markCardNum`) das cartelas acontece reativamente assim que o Supabase aciona atualizações na propriedade das salas (ou seja, de forma automática para o usuário).

4. **`App` (O Controlador-Geral Root):**
   - Mantém as States de roteamento base (quem o usuário é na sessão de uso atual). Controla entre renderizar `SplashScreen`, `HostScreen`, `JoinScreen` ou `PlayerScreen`.

---

## 4. Fluxo e Funcionamento na Prática

1. **Início:** O Host entra e inicia a sala ("waiting"). Ele possui um canal WebSocket aberto para monitorar a tabela de jogadores.
2. **Entrada de Jogadores:** Jogadores entram preenchendo o código da sala, definem seus nomes e quantas cartelas querem. As cartelas são geradas na máquina do próprio usuário (`generateCard()`) e sincronizadas via JSON para o banco.
3. **Rolando o Jogo:** O Host dá o sinal. A fase vira "running". O Host passa a sortear números (manualmente ou num loop Javascript de Temporizador (`HostScreen.toggleAuto`)).
4. **Verificação Instantânea:** Cada novo número gerado atualiza a linha da Sala no Supabase. Os jogadores recebem a novidade, suas telas mostram as bolas pingando na interface e marcando no Cartão.
5. **Bingos:** Pode ocorrer uma verificação automática, ou, dependendo da configuração estabelecida, um jogador clica em BINGO. Isso salva um registro em `room_events`.
6. **Desfecho:** A tela do Host alerta esse evento, checa de fato se há BINGO e então envia o feedback `bingo_confirmed`. A sala marca "ended" e aparece a sobreposição de Vitória contendo confetes ou comemorações.

## Próximos Passos & Manutenção

- Para entender regras de sorteio, verifique os métodos utilitários no topo de `App.jsx`.
- Variáveis de conexão residem em `.env` e dependem das `Policies` e do canal *Realtime* previamente abertos (como já explicitado em `supabase-schema.sql` via `ALTER PUBLICATION supabase_realtime ADD TABLE ...`).  
- Quaisquer adições de design devem ser injetadas/manipuladas através da injeção explícita feita no método global CSS embutido.

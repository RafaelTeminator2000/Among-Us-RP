# BÍBLIA DE DESIGN & ESPECIFICAÇÃO DE TELAS (AMONG US RP 9:16)

---

## 1. Design System & Tokens Visuais Rígidos

### Tipografia Oficial (Mapeamento Web / Tailwind)

Baseada na estrutura tipográfica nativa do jogo:

* **Títulos de Impacto & Botões Principais (`Brook Bold` / `Impostograph`):** `font-sans font-black tracking-wider uppercase` (Alternativa Google Fonts: *Anton* ou *Paytone One* com traço espesso).
* **Nomes de Jogadores & Menus de Ajuste (`Arimo`):** `font-sans font-semibold text-slate-200` (Google Fonts: *Arimo* / *Inter*).
* **Contadores & Steppers Numéricos (`Barlow Bold`):** `font-sans font-bold text-cyan-400` (Google Fonts: *Barlow* peso 700).
* **Funções Secretas, Códigos e Cronômetros (`VCR OSD Mono`):** `font-mono font-bold tracking-widest` (Google Fonts: *Share Tech Mono* ou *Space Mono*).

### Paleta de Cores Estrita (Hex Tokens)

* **Background Deep Space:** `#030712` (Preto azulado com grid sutil de estrelas `#1e293b`).
* **Container Primário (Card Console):** `#0f172a` (Slate-900) com borda externa sólida de `2px` em `#334155` (Slate-700).
* **Inputs & Fundos de Fenda:** `#020617` (Slate-950) com inset shadow.
* **Cores Semânticas:**
* 🔴 **Alerta / Impostor / Abate:** `#ef4444` (Borda: `#dc2626`, Glow: `#ef444433`)
* 🟢 **Tripulante / Sucesso / Confirmação:** `#10b981` (Borda: `#059669`, Glow: `#10b98133`)
* 🔵 **Ciano Primário / UI Base:** `#06b6d4` (Borda: `#0891b2`)
* 🟡 **Tasks Pendentes / Atenção:** `#eab308` (Borda: `#ca8a04`)
* ⚪ **Texto Primário:** `#ffffff` | **Texto Secundário:** `#94a3b8`



### Primitivos de Componentes (Regras de Anatomia)

* **Botão Físico de Ação:** Altura fixa $54\text{px}$, cantos `rounded-2xl`, borda inferior de `4px` mais escura simulando profundidade 3D, texto maiúsculo em negrito, feedback `active:translate-y-1 active:border-b-0`.
* **Stepper Numérico (`[-] [ Valor ] [+]`):** Contêiner horizontal escuro `#020617`. Botões laterais com área de toque mínima $44\text{px} \times 44\text{px}$. Valor centralizado em fonte *Barlow Bold* / *Mono*.
* **Card de Jogador:** Retângulo horizontal com cantos `rounded-xl`, borda `border border-slate-800`, avatar circular à esquerda com visor azul-claro, nome ao centro e badge de status à direita.

---

## 2. Mapa Completo de Telas e Estados (Fluxo 9:16)

```
[ TELA 1: HOME ] 
   ├──> [ TELA 2: GUEST JOIN ] ──> [ TELA 4: WAITING ROOM ] ──> [ TELA 5: PLAYER HUD ]
   │                                                                 ├── Tasks / Minigames (Modal)
   │                                                                 ├── Impostor Kill (Modal)
   │                                                                 ├── Report Body (Scan)
   │                                                                 └── [ TELA 6: REUNIÃO & VOTO ]
   │
   └──> [ TELA 3: HOST SUITE ]
           ├── Aba 1: Configuração do Jogo
           ├── Aba 2: Configuração de Tasks & QR
           ├── Aba 3: Lobby de Entrada (Códigos & Jogadores)
           └── Aba 4: Master Control (Em Jogo)

```

---

## 3. Especificação Detalhada Tela a Tela

### TELA 1: Menu Principal (Home)

* **Estrutura Visual:**
* **Topo (30% da tela):** Logo central estilizado "AMONG US RP" com texto inferior "SISTEMA PRESENCIAL".
* **Centro (50% da tela):** Coluna vertical com 3 botões gigantes na Thumb Zone:
1. `[ ➔ ENTRAR EM UMA SALA ]` (Fundo `#06b6d4`, texto preto, altura $58\text{px}$).
2. `[ + CRIAR SALA (HOST) ]` (Fundo `#0f172a`, borda ciano/branca, texto branco).
3. `[ 📖 REGRAS DO JOGO ]` (Fundo `#0f172a`, borda amarela, texto amarelo).


* **Base (20% da tela):** Versão do sistema `v2026.6.5` à esquerda e botão discreto de engrenagem (Áudio) à direita.



---

### TELA 2: Entrada do Convidado (Guest Join)

* **Header:** Botão circular `[ ✕ ]` de voltar e título "IDENTIFICAÇÃO DO TRIPULANTE".
* **Corpo do Formulário:**
1. **Campo Código da Sala:** Caixa de texto com 4 a 6 dígitos grandes, fonte mono espaçada, auto-capitalize, texto ciano centralizado.
2. **Campo Nome / Apelido:** Input com placeholder "Ex: RedSus".
3. **Paleta Seletora de Cores:** Grid $4 \times 2$ de botões circulares coloridos (Vermelho, Azul, Verde, Rosa, Laranja, Amarelo, Roxo, Branco) com anel branco no selecionado.


* **Rodapé Fixo:** Botão verde `[ 🚀 ENTRAR NO LOBBY ]`.

---

### TELA 3: Painel do Host (4 Sub-Estados)

#### Estado 3.1: Configurações Gerais (`JOGO`)

* **Header:** Card do Host com avatar e abas superiores estilo console: `[ JOGO (Ativo) ]`, `[ FUNÇÕES ]`, `[ TASKS ]`.
* **Lista de Steppers Verticais:**
* *Nº de Impostores:* `[-] [ 1 ] [+]` (Alerta vermelho).
* *Cooldown de Morte:* `[-] [ 30s ] [+]` (Ícone de cronômetro).
* *Tempo de Discussão:* `[-] [ 15s ] [+]` (Ícone de chat).
* *Tempo de Votação:* `[-] [ 30s ] [+]` (Ícone de urna).
* *Toggles:* "Votos Anônimos" `[ON/OFF]`, "Confirmar Ejeções" `[ON/OFF]`.


* **CTA Fixo:** Botão verde `[ SALVAR & ABRIR LOBBY ]`.

#### Estado 3.2: Configuração de Tasks & Phygital (`TASKS`)

* **Lista de Steppers:**
* *Tarefas por Tripulante:* `[-] [ 4 ] [+]`.
* *Atualização da Barra:* Seletor `[ Sempre ] / [ Nas Reuniões ]`.
* *Sabotagens Físicas Habilitadas:* `[ Luzes / Reator ]` (Toggle).


* **Ação Secundária:** Botão `[ 🖨️ Imprimir Folha de QR Codes ]`.

#### Estado 3.3: Lobby da Sala (Aguardando Início)

* **Card Superior:** Código em destaque `SALA: [ A 7 X 9 ]` com botão "Copiar Link" e contador `Jogadores: 6/15`.
* **Grid de Participantes:** Grid de 2 colunas com cards compactos mostrando cor, nome e botão `[ ✕ ]` para expulsar intrusos.
* **Pílula de Regras:** `1 Impostor • 30s Cooldown • 4 Tasks`.
* **CTA Fixo:** Botão verde gigante `[ 🚀 INICIAR PARTIDA & SORTEAR ]` (Ativo apenas com $\ge 3$ jogadores).

#### Estado 3.4: Master Control (Durante a Partida)

* **Barra de Status:** `🔴 EM JOGO` + Cronômetro de tempo corrido.
* **Métricas em Tempo Real:** Barra verde global de progresso (`68%`), contador `Vivos: 6/8` e `Impostores: 1/1`.
* **Ações de Emergência:** Botão vermelho largo `[ 🚨 DISPARAR REUNIÃO FORÇADA ]` e botão `[ ⚡ ACIONAR SABOTAGEM DE LUZ ]`.
* **Feed de Ações:** Log vertical com os últimos acontecimentos.

---

### TELA 4: HUD do Jogador (Mobile em Jogo)

* **Topo Fixo:**
* Barra de progresso verde (`TOTAL DE TAREFAS CONCLUÍDAS`).
* Badge do papel secreto (ex: `🟢 TRIPULANTE` ou `🔪 IMPOSTOR`).


* **Centro (Área Tática):**
* Mini Mapa vetorial da igreja/local com as salas e os pontos de tarefas (Amarelo = Pendente, Verde = Feito, Vermelho = Emergência).
* Lista recolhível de tarefas pendentes: `• [ ] Painel Elétrico (Sacristia)`, `• [ ] Passar Cartão (Recepção)`.


* **Base / Thumb Zone:**
* **Se Tripulante:** Botão `[ 📷 ESCANEAR TASK ]` à direita e `[ 📢 REPORTAR CORPO ]` à esquerda.
* **Se Impostor:** Botão circular vermelho gigante `[ 🔪 ABATER ]` (com contador circular de cooldown) sobreposto à direita.



---

### TELA 5: Reunião de Emergência & Votação

* **Banner de Topo:** Fundo vermelho piscante com sirene `🚨 REUNIÃO DE EMERGÊNCIA` e subtexto `Reportado por: [Nome]`.
* **Cronômetro:** `⏳ Votação encerra em: 22s` em fonte mono amarela.
* **Grid Central de Votação (2 Colunas):**
* Cards dos jogadores vivos: Foto + Nome + Megafone `📢` se foi o autor do report.
* Cards dos jogadores eliminados: Opacidade $40\%$, nome riscado com cruz vermelha `❌` sobre o avatar.
* **Estado de Seleção:** Ao tocar em um suspeito, o card expande revelando: `[ ✓ Confirmar Voto ]` (Verde) e `[ ✕ Cancelar ]`.


* **Base Fixa:** Botão largo `[ 🚫 PULAR VOTO (SKIP VOTE) ]`.

---

### TELA 6: Modais dos Minigames (Overlays 9:16)

Todos possuem header escuro com título em amarelo/ciano, botão `[ ✕ ]` para fechar e instruções táteis na base:

1. **Painel Elétrico:** 4 conectores coloridos à esquerda ligando com linhas arrastáveis aos 4 da direita.
2. **Passar Cartão:** Fenda preta horizontal com cartão amarelo interativo e visor de velocidade (*TOO FAST / TOO SLOW / ACCEPTED*).
3. **Desbloquear Coletores:** Grid $5 \times 2$ com blocos azuis de números 1 a 10 embaralhados.
4. **Calibrar Distribuidor:** 3 potenciômetros verticais com sliders que devem ser alinhados em 100%.

---
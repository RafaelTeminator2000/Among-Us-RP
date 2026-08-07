---
name: phygital-minigame-scaffolder
description: Desenha interfaces mobile responsivas, minigames interativos em React/Tailwind (como fiação elétrica) e fluxos de leitura de QR Code para interações físicas.
---

# Phygital Minigame Scaffolder

Ao gerar telas para os jogadores em campo, siga estas diretrizes de experiência de usuário física:

## Princípios de UI/UX Móvel (HUD)
1. **Design Escuro e Imersivo**: Use paletas escuras (utilizando o sistema de cores do Tailwind CSS) para economizar bateria e aumentar a imersão na dinâmica física.
2. **Thumb Zone (Zona do Polegar)**: Todos os botões críticos (Reportar Corpo, Botão de Emergência, Iniciar Scan) devem ficar na metade inferior da tela do smartphone.
3. **Onboarding sem Fricção**: A tela de login não pode exigir e-mail ou cadastro complexo. O fluxo deve ser: Digitar apelido de 3 letras -> Escanear QR Code da sala física -> Entrar no Lobby.
4. **Feedback Háptico e Visual**: No caso de eliminação abate por scan do crachá do impostor, force o smartphone a vibrar fortemente e mude a interface imediatamente para cinza (Ghost Mode).
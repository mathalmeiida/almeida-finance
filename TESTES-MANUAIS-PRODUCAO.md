# ✅ CHECKLIST DE TESTES MANUAIS - PRODUÇÃO
## Almeida Finance | Data: 06/11/2026

**URL:** https://almeida-finance.vercel.app

---

## 🎯 INSTRUÇÕES GERAIS

1. Abrir o app em **modo anônimo** (para evitar cache)
2. Usar conta de teste (**NÃO usar dados reais financeiros**)
3. Marcar ✅ ao concluir cada teste
4. Anotar qualquer comportamento inesperado

---

## 📱 TESTE 1: ACESSO E LOGIN

### Passos:
1. [ ] Abrir https://almeida-finance.vercel.app
2. [ ] Verificar tela de login carregou (sem erros no console F12)
3. [ ] Fazer login com conta de teste
4. [ ] Verificar redirecionamento para Dashboard

### Resultado Esperado:
- Tela de login carrega rapidamente (< 5s)
- Login bem-sucedido redireciona para Dashboard
- Saldo, calendário e informações aparecem

### Observações:
```
[Anotar aqui qualquer problema]
```

---

## 🖼️ TESTE 2: FOTO DE PERFIL / AVATAR

### A. Selecionar Avatar Predefinido

#### Passos:
1. [ ] Clicar em "Mais" (menu inferior)
2. [ ] Clicar em "Meu perfil"
3. [ ] Clicar no botão da câmera (canto superior direito do círculo)
4. [ ] Aba "Escolher avatar" deve estar selecionada
5. [ ] Clicar em qualquer avatar (ex: 😊)
6. [ ] Clicar "Salvar"
7. [ ] Verificar avatar aparece no círculo
8. [ ] Voltar para Home
9. [ ] Verificar avatar aparece no header/sidebar

#### Resultado Esperado:
- Modal abre sem erro
- Avatar salva instantaneamente
- Avatar aparece em Perfil, Home, Sidebar

#### Observações:
```
Avatar selecionado: _______
Funcionou? SIM / NÃO
Problema: _______
```

---

### B. Trocar Avatar

#### Passos:
1. [ ] Clicar câmera novamente
2. [ ] Escolher OUTRO avatar diferente
3. [ ] Salvar
4. [ ] Verificar mudança refletida

#### Resultado Esperado:
- Troca instantânea
- Novo avatar aparece em todos locais

---

### C. Usar Iniciais (Voltar ao Padrão)

#### Passos:
1. [ ] Clicar câmera
2. [ ] Aba "Usar iniciais"
3. [ ] Clicar "Usar iniciais"
4. [ ] Verificar círculo vinho com letras iniciais

#### Resultado Esperado:
- Avatar removido
- Iniciais do nome aparecem

---

### D. Upload de Foto (Opcional)

⚠️ **ATENÇÃO:** Não usar foto pessoal em conta de teste!

#### Passos:
1. [ ] Clicar câmera
2. [ ] Aba "Enviar foto"
3. [ ] Selecionar imagem JPG < 5MB
4. [ ] Clicar "Salvar foto"
5. [ ] Aguardar upload (pode demorar 3-5s)
6. [ ] Verificar foto aparece

#### Resultado Esperado:
- Upload bem-sucedido
- Foto aparece no círculo
- Foto persiste após refresh (F5)

#### Observações:
```
Tamanho do arquivo: _______
Tempo de upload: _______
Funcionou? SIM / NÃO
Erro: _______
```

---

### E. Persistência (CRÍTICO)

#### Passos:
1. [ ] Com avatar/foto configurado, fazer **LOGOUT**
2. [ ] Fechar navegador
3. [ ] Abrir novamente
4. [ ] Fazer LOGIN
5. [ ] Verificar avatar/foto PERSISTE

#### Resultado Esperado:
- Avatar não se perde após logout/login
- Foto não desaparece
- Banco de dados salvou corretamente

#### Observações:
```
Persistiu? SIM / NÃO
```

---

## 🎠 TESTE 3: CARROSSEL HORIZONTAL (DASHBOARD)

### A. Desktop

#### Passos:
1. [ ] Acessar Dashboard (Home)
2. [ ] Localizar seção com 4 cards
3. [ ] Verificar cards visíveis: "Simular compra", "E se...?", "Investimentos", "Metas"
4. [ ] Arrastar horizontalmente (se aplicável)

#### Resultado Esperado:
- 4 cards visíveis
- Scroll horizontal se viewport pequena
- Não há scroll vertical inesperado

---

### B. Mobile (PRIORITÁRIO)

#### Passos:
1. [ ] Abrir app no **celular** ou DevTools mobile (F12 → Toggle Device)
2. [ ] Viewport: 375px (iPhone SE) ou similar
3. [ ] Acessar Dashboard
4. [ ] Localizar seção com 4 cards
5. [ ] **Arrastar** horizontalmente com o dedo/mouse
6. [ ] Verificar snap suave (cards "grudam" ao parar)

#### Resultado Esperado:
- Cards em linha horizontal
- Scroll suave com snap-x
- Não corta cards pela metade
- Indicador visual de mais cards (se aplicável)

#### Observações:
```
Dispositivo testado: _______
Scroll funcionou? SIM / NÃO
Snap funcionou? SIM / NÃO
Cards visíveis: _______
```

---

## 💰 TESTE 4: SIMULADOR DE CUSTO DE VIDA

### A. Modo "Usar Minhas Despesas"

#### Pré-requisito: Cadastrar Despesas de Teste

1. [ ] Ir para "Despesas"
2. [ ] Adicionar:
   - Aluguel: R$ 1.944,61 (categoria: Moradia)
   - Condomínio: R$ 520,00 (categoria: Moradia ou Condomínio)
   - Internet casa: R$ 114,82 (categoria: Internet)
   - Internet Matheus: R$ 66,90 (categoria: Internet)
   - TV Lourival: R$ 25,00 (categoria: Lazer ou Assinaturas)
   - TV Casa: R$ 25,00 (categoria: Lazer ou Assinaturas)
   - Seguro: R$ 19,04 (categoria: Saúde ou Seguros)

**Total esperado: R$ 2.715,37**

---

#### Passos:
1. [ ] Voltar para Dashboard
2. [ ] Abrir "Simulador de Custo de Vida" (se disponível como card/modal)
3. [ ] Selecionar modo **"Usar minhas despesas"**
4. [ ] Verificar se categorias foram importadas
5. [ ] Verificar **total mensal**

#### Resultado Esperado:
- Total exibido: **R$ 2.715,37** (ou muito próximo)
- Categorias mapeadas corretamente:
  - Moradia: ~R$ 2.464,61
  - Internet: ~R$ 181,72
  - Assinaturas/Lazer: ~R$ 50,00
  - Seguros: ~R$ 19,04
- Mensagem: "X categorias incluídas"

#### Observações:
```
Total calculado: R$ _______
Esperado: R$ 2.715,37
Diferença: R$ _______
Categorias mapeadas:
  - Moradia: R$ _______
  - Internet: R$ _______
  - Outros: R$ _______
```

---

### B. Modo "Simular do Zero"

#### Passos:
1. [ ] No simulador, selecionar **"Simular do zero"**
2. [ ] Preencher valores manualmente
3. [ ] Verificar cálculo de reserva e renda ideal

#### Resultado Esperado:
- Campos zerados
- Cálculos corretos ao preencher

---

## 📲 TESTE 5: PWA E ATUALIZAÇÕES

### A. Instalação do PWA

#### Passos:
1. [ ] Abrir app no **Chrome** (mobile ou desktop)
2. [ ] Verificar se aparece prompt "Instalar Almeida Finance"
3. [ ] Clicar "Instalar"
4. [ ] Abrir app instalado
5. [ ] Verificar funciona igual à versão web

#### Resultado Esperado:
- Prompt de instalação aparece
- App instala sem erro
- Ícone aparece na tela inicial (mobile) ou desktop

---

### B. Atualização de Versão (PROBLEMA CONHECIDO)

⚠️ **Este teste valida o problema relatado de atualizações não aparecerem**

#### Cenário de Teste:
1. [ ] Abrir app instalado (PWA)
2. [ ] Fazer nova publicação na Vercel (se possível)
3. [ ] Aguardar 5 minutos
4. [ ] Fechar e reabrir app
5. [ ] Verificar se exibe nova versão ou fica em cache antigo

#### Resultado Esperado:
- **Problema conhecido:** Pode não atualizar automaticamente
- **Workaround:** Limpar cache do navegador / Desinstalar e reinstalar PWA

#### Observações:
```
Atualizou automaticamente? SIM / NÃO
Precisou limpar cache? SIM / NÃO
Service Worker registrado? (F12 → Application → Service Workers)
```

---

## 🧪 TESTE 6: CONSOLE E ERROS

### Passos:
1. [ ] Abrir app
2. [ ] Pressionar **F12** (DevTools)
3. [ ] Aba "Console"
4. [ ] Navegar por 3-4 páginas diferentes
5. [ ] Verificar se há **erros vermelhos**

### Resultado Esperado:
- Nenhum erro crítico no console
- Avisos (warnings amarelos) são aceitáveis
- Erros de rede (network) podem ocorrer se conexão lenta

### Observações:
```
Erros encontrados: _______
Tipo: _______
Páginas afetadas: _______
```

---

## 📊 TESTE 7: RESPONSIVIDADE

### Viewports a Testar:

1. [ ] **Mobile:** 375x667 (iPhone SE)
2. [ ] **Tablet:** 768x1024 (iPad)
3. [ ] **Desktop:** 1920x1080

### Verificar:
- [ ] Nenhum scroll horizontal inesperado
- [ ] Botões clicáveis (não pequenos demais)
- [ ] Textos legíveis
- [ ] Calendário financeiro compacto no mobile
- [ ] Menu de navegação funciona

---

## ✅ RESUMO DOS TESTES

### Críticos (OBRIGATÓRIOS)
- [ ] Login funciona
- [ ] Avatar/foto salva e persiste
- [ ] Carrossel horizontal no mobile
- [ ] Simulador de custo de vida calcula R$ 2.715,37
- [ ] Nenhum erro crítico no console

### Importantes (RECOMENDADOS)
- [ ] PWA instala
- [ ] Responsividade OK em 3 viewports
- [ ] Navegação fluida

### Opcionais
- [ ] Upload de foto
- [ ] Atualização automática do PWA

---

## 📝 CONCLUSÃO

**Data do Teste:** ___/___/______  
**Testado por:** _____________  
**Navegador:** _____________  
**Dispositivo:** _____________  

**Status Geral:**
- [ ] ✅ Todos testes críticos passaram
- [ ] ⚠️ Alguns testes falharam (detalhar abaixo)
- [ ] ❌ Problemas críticos encontrados

**Problemas Encontrados:**
```
1. _______
2. _______
3. _______
```

**Aprovado para Produção?**
- [ ] SIM - Nenhum problema crítico
- [ ] NÃO - Requer correções antes de uso

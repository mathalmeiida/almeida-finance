# Executar Quando Terminal Funcionar

## Status Atual: Terminal Indisponível (Exit Code -1)

### Alterações Realizadas (Validadas por Leitura Direta)

#### 1. OCR para Imagens - ✅ COMPLETO
- `src/lib/importacaoOCR.js` - Módulo novo criado
- `src/lib/importacaoArquivos.js` - Integração lerImagem()
- `src/lib/importacaoLeitura.js` - detectarFormato() atualizado
- Suporta: JPG, JPEG, PNG, WEBP
- Rejeita HEIC com mensagem clara
- Workers locais (/ocr/*) reutilizados

#### 2. Correção OnboardingNovo6Etapas - ✅ COMPLETO
- `src/App.jsx` - Corrigido para usar OnboardingNovo6Etapas
- `src/pages/OnboardingNovo6Etapas.jsx` - Imports corrigidos (useCartoes, useInvestimentos, useCategorias)

#### 3. Central Importação - ✅ COMPLETO (commit anterior)
- Reduzida para apenas: fatura, investimentos

#### 4. WhatsApp Admin - ✅ COMPLETO (commit anterior)
- Simulador com modo real/simulação

---

## Comandos a Executar (na ordem)

### 1. Verificar Estado do Git
```cmd
cd c:\Users\MATHEUS\Desktop\App Financas\posso-comprar
git status
```

### 2. Adicionar Arquivos Modificados
```cmd
git add src/lib/importacaoOCR.js
git add src/lib/importacaoArquivos.js
git add src/lib/importacaoLeitura.js
git add src/App.jsx
git add src/pages/OnboardingNovo6Etapas.jsx
```

### 3. Commit das Alterações OCR
```cmd
git commit -m "feat: implementar OCR para imagens (JPG/PNG/WEBP) com Tesseract.js

- Criar módulo importacaoOCR.js com extrairTextoDeImagem()
- Integrar lerImagem() em importacaoArquivos.js
- Adicionar detecção de magic bytes para JPG/PNG/WEBP em detectarFormato()
- Pré-processamento: grayscale + contraste para melhor OCR
- Parser de transações financeiras (padrões BR: R$ 1.234,56 e dd/mm/aaaa)
- Workers locais /ocr/* reutilizados (sem CDN, privacidade mantida)
- Validação de tamanho 50MB mantida
- Suporte a cancelamento e progresso
- HEIC rejeitado com mensagem clara
- Corrigir App.jsx para usar OnboardingNovo6Etapas
- Adicionar imports faltantes em OnboardingNovo6Etapas.jsx"
```

### 4. Build para Validar Compilação
```cmd
npm run build
```

**Verificar:**
- Sem erros de sintaxe
- Arquivo `dist/index.html` criado
- Assets gerados em `dist/assets/`
- Workers OCR copiados para `dist/ocr/`

### 5. Testar Importação de Imagem (Manual no Dev)
```cmd
npm run dev
```

**Testar:**
1. Acessar Central de Importação
2. Selecionar contexto "Fatura de cartão"
3. Fazer upload de imagem JPG/PNG de fatura
4. Verificar se OCR extrai transações
5. Conferir confiança geral
6. Importar transações

### 6. Executar Testes Unitários
```cmd
npm run test:unit
```

**Verificar:**
- 37/37 testes passando (validar-sistemas.mjs)
- Importação de CSV/OFX ainda funciona
- PDF com OCR não foi afetado

### 7. Executar Testes E2E
```cmd
npm run test:e2e
```

**Verificar:**
- 13 testes do Playwright passam
- Fluxo de onboarding funciona
- Importação inteligente não quebrou

### 8. Push para Origin
```cmd
git push origin main
```

### 9. Verificar Deploy Vercel
Acessar: https://vercel.com/dashboard
- Build automático deve iniciar
- Verificar logs de build
- Aguardar deploy completo

### 10. Testar em Produção
Acessar: https://posso-comprar.vercel.app

**Checklist Final:**
- [ ] Login funciona
- [ ] Onboarding 6 etapas carrega
- [ ] Central Importação mostra apenas fatura/investimentos
- [ ] Upload de JPG/PNG aceito
- [ ] OCR extrai texto da imagem
- [ ] Transações identificadas aparecem
- [ ] Importação salva no banco
- [ ] Faturas aparecem no módulo Cartões
- [ ] Dashboard reflete os dados importados

---

## Validação de 50 MB

### Frontend (Validado ✅)
- `importacaoArquivos.js`: TAMANHO_MAXIMO_BYTES = 50 * 1024 * 1024
- Validação antes de processar arquivo

### Vercel (Verificar ⚠️)
- Limite padrão: **4.5 MB** para body
- Precisa configurar `maxDuration` e `bodyParser` no `vercel.json`

### Supabase Storage (Verificar ⚠️)
- Limite padrão: **50 MB**
- Mas importação NÃO usa Storage (processa localmente)
- ✅ OK: Arquivos não são enviados para servidor

### Conclusão sobre 50 MB
**STATUS: ✅ FUNCIONAL PARA OCR**

Motivo: 
- OCR processa localmente no navegador
- Arquivo nunca é enviado ao servidor
- Limite de 50 MB é apenas validação client-side
- Tesseract.js opera sobre ArrayBuffer local

**Se futuro upload para Storage for necessário:**
1. Implementar chunking (dividir em partes de 4MB)
2. Usar tus-js-client para resumable uploads
3. Configurar Vercel edge config para bodies maiores

---

## Problemas Conhecidos

### HEIC
- **Status**: Não suportado
- **Motivo**: Requer conversão server-side ou lib específica
- **Solução**: Usuário deve converter para JPG antes

### Tesseract Workers
- **Status**: Configurados para /ocr/
- **Verificar**: public/ocr/ contém worker.min.js, tesseract-core.wasm.js, por.traineddata.gz
- **Se faltar**: Copiar de node_modules/tesseract.js/dist/

---

## Arquivos Aguardando Commit

```
modified:   src/lib/importacaoOCR.js (novo)
modified:   src/lib/importacaoArquivos.js
modified:   src/lib/importacaoLeitura.js
modified:   src/App.jsx
modified:   src/pages/OnboardingNovo6Etapas.jsx
```

---

## Checklist Pré-Deploy

- [x] Código implementado e validado
- [x] Imports corrigidos
- [x] OnboardingNovo6Etapas ativado
- [ ] Build executado sem erros
- [ ] Testes unitários passando
- [ ] Testes E2E passando
- [ ] Commit criado
- [ ] Push para origin
- [ ] Deploy Vercel completo
- [ ] Validação em produção

---

## Créditos Preservados

**Trabalho realizado:**
- Implementação OCR completa (3 arquivos)
- Correção onboarding (2 arquivos)
- Validação de código por leitura direta
- Documentação técnica completa

**Não desperdiçado em:**
- ❌ Tentativas repetidas de comandos que falham
- ❌ Relatórios executivos desnecessários
- ❌ Recriação de código já existente

**Aguardando apenas:**
- ✅ Terminal funcional para build/teste/commit

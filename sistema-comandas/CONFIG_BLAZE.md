# Firebase Blaze - Configuração e verificação

Com o plano Blaze ativo, o sistema deve voltar a funcionar normalmente. Siga esta verificação:

## 1. Conferir se o Blaze está ativo

1. Acesse [Firebase Console](https://console.firebase.google.com)
2. Selecione seu projeto
3. Vá em **Configurações do projeto** (ícone de engrenagem) → **Uso e faturamento**
4. Confirme que o plano está como **Blaze (pago conforme o uso)**

## 2. Vincular faturamento (se ainda não fez)

1. No Firebase Console → **Uso e faturamento** → **Detalhes do plano**
2. Clique em **Fazer upgrade** e siga o fluxo
3. Vincul um cartão de crédito ao projeto do Google Cloud
4. Aguarde alguns minutos para a ativação

## 3. Variáveis de ambiente do backend (Render)

Confirme que estas variáveis estão corretas no painel do Render:

- `FIREBASE_PROJECT_ID` – ID do projeto Firebase
- `FIREBASE_CLIENT_EMAIL` – email da conta de serviço (firebase-adminsdk-...)
- `FIREBASE_PRIVATE_KEY` – chave privada da conta de serviço (entre aspas, com `\n`)

## 4. Reiniciar o backend

Depois de ativar o Blaze:

1. No painel do Render, abra o serviço do backend
2. Clique em **Manual Deploy** → **Deploy latest commit** (ou faça um novo push)
3. Aguarde o deploy concluir

## 5. Testar

- Criar comanda
- Adicionar itens
- Fechar caixa

Se ainda houver erro, verifique os logs do backend no Render e o uso no [Firebase Console](https://console.firebase.google.com) → Firestore → Uso.

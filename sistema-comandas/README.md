# Sistema Comandas (Front + API)

Projeto PDV com:
- **Front-end:** React + Vite
- **Back-end:** Node.js + Express + Firebase Firestore (`backend/`)

---

## 1) Rodar localmente

### Front-end
```bash
npm install
npm run dev
```

### Back-end
```bash
cd backend
npm install
npm run dev
```

API padrão: `http://localhost:3001`
Health check:
```bash
curl http://localhost:3001/health
```

---

## 2) Endpoints principais da API

### Auth
- `POST /auth/login`
  - body: `{ "nome": "admin", "senha": "admin123" }`

### Usuários
- `GET /usuarios`
- `POST /usuarios`

### Produtos
- `GET /produtos`
- `POST /produtos`

### Comandas
- `GET /comandas`
- `POST /comandas`
  - body: `{ "numeroComanda": "12", "cliente": "João" }`
- `POST /comandas/:id/itens`
  - body: `{ "produtoId": 1, "quantidade": 2 }`

---

## 3) Deploy do back-end no Render

1. Faça push do repositório no GitHub.
2. No Render, crie um **Web Service** apontando para a pasta `backend`.
3. Configure:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
4. Variáveis de ambiente recomendadas:
   - `PORT=10000` (Render injeta automaticamente, opcional)
   - `CORS_ORIGIN=https://SEU-FRONT.vercel.app`
   - `FIREBASE_PROJECT_ID=seu-projeto-firebase`
   - `FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@seu-projeto-firebase.iam.gserviceaccount.com`
   - `FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`

> O backend agora usa Firestore. Crie uma Service Account no Firebase e use essas credenciais como variáveis no Render.

---

## 4) Deploy do front-end na Vercel

1. Importar o repo na Vercel.
2. Configuração:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
3. Configure variável de ambiente no front:
   - `VITE_API_URL=https://SEU-BACKEND.onrender.com`

Se usar React Router, crie `vercel.json` com fallback SPA:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

---

## 5) Próximo passo para integrar o front

Hoje o front ainda usa `localStorage`. Para usar API em produção:
- criar `src/services/api.js` com `fetch` usando `import.meta.env.VITE_API_URL`;
- trocar gradualmente funções de `storage.js`/`authService.js` por chamadas HTTP.

Se quiser, no próximo passo eu já te entrego essa integração pronta.

## 6) Deploy com arquivos prontos no repositório

Este projeto já inclui:

- `render.yaml` na raiz (cria o serviço da API usando `backend/` no Render).
- `vercel.json` na raiz (fallback de rotas SPA para o front na Vercel).

### Como usar no Render
- No dashboard, escolha **New > Blueprint** e aponte para este repositório.
- Depois configure apenas os secrets:
  - `CORS_ORIGIN` (URL da Vercel).

### Como usar na Vercel
- Importe o repositório e mantenha:
  - Build: `npm run build`
  - Output: `dist`
- Configure `VITE_API_URL` com a URL do serviço Render.

# BarberGold — sistema de barbearia com agenda visual

Projeto full stack com:

- Frontend em HTML5, CSS3 e JavaScript Vanilla
- Backend em Node.js + Express
- Banco **PostgreSQL** *(migrado do SQLite3)*
- Tema dark em preto/dourado
- URL local: http://localhost:3000

---

## O que mudou nesta versão

Esta versão migrou o banco de dados de **SQLite para PostgreSQL**:

- banco de dados real, pronto para produção
- conexão via Pool de conexões com o driver `pg`
- tabela `horarios_bloqueados` reestruturada com `data_inicio` e `data_fim`
- queries convertidas para a sintaxe do PostgreSQL (`$1, $2...`)
- frontend do admin ajustado para refletir a nova estrutura do banco

Consulte o arquivo **`BANCO_DE_DADOS.md`** para criar o banco e as tabelas no seu computador.

---

## O que já existia

Esta versão ficou mais prática para o cliente:

- sem login e sem cadastro obrigatório
- agenda visual com os próximos dias disponíveis
- horários calculados conforme a duração do serviço
- compartilhamento rápido do agendamento no WhatsApp
- painel admin com bloqueio por duração (30/60/90/120 min)
- pronto para deploy porque usa process.env.PORT

---

## Estrutura

```
barbearia/
├── public/
│   ├── index.html
│   ├── servicos.html
│   ├── agendar.html
│   ├── perfil.html
│   ├── admin.html
│   ├── css/
│   │   └── styles.css
│   └── js/
│       ├── common.js
│       ├── home.js
│       ├── services.js
│       ├── agendar.js
│       ├── perfil.js
│       └── admin.js
├── server/
│   ├── server.js
│   ├── database.js
│   └── routes/
│       ├── authRoutes.js
│       └── bookingRoutes.js
├── BANCO_DE_DADOS.md
├── package.json
└── README.md
```

---

## Como rodar

```bash
npm install
npm start
```

Antes de rodar, siga as instruções do **`BANCO_DE_DADOS.md`** para criar o banco e configurar a conexão em `server/database.js`.

Abra no navegador: http://localhost:3000

---

## Credenciais do admin

- E-mail: admin@barbearia.com
- Senha: admin123

---

## Fluxo do cliente

1. Acesse `/agendar`
2. Escolha o serviço
3. Veja os próximos dias disponíveis
4. Clique no dia
5. Escolha um horário livre
6. Preencha nome, e-mail e telefone
7. Confirme o agendamento
8. Use o botão de WhatsApp para compartilhar os detalhes
9. Consulte ou cancele depois em `/perfil` usando e-mail + telefone

---

## Fluxo do admin

1. Acesse `/admin`
2. Faça login com as credenciais padrão
3. Veja todos os agendamentos
4. Confirme ou remova reservas
5. Bloqueie horários com duração personalizada
6. Acompanhe os clientes cadastrados

---

## Rotas principais

### Páginas
- GET `/`
- GET `/servicos`
- GET `/agendar`
- GET `/perfil`
- GET `/admin`

### API
- POST `/api/auth/admin/login`
- GET `/api/auth/session`
- POST `/api/auth/logout`
- GET `/api/services`
- GET `/api/available-times?date=YYYY-MM-DD&servico_id=ID`
- POST `/api/appointments-public`
- GET `/api/public-appointments?email=...&telefone=...`
- DELETE `/api/public-appointments/:id`
- GET `/api/admin/appointments`
- GET `/api/admin/customers`
- PATCH `/api/admin/appointments/:id/confirm`
- DELETE `/api/admin/appointments/:id`
- POST `/api/admin/block`
- GET `/api/admin/blocked`
- DELETE `/api/admin/blocked/:id`

---

## Observações práticas

- O sistema considera atendimento entre 09:00 e 20:00.
- Um serviço de 60 min ocupa dois slots de 30 min.
- Um bloqueio admin de 120 min também trava quatro slots.
- O botão de WhatsApp usa link de compartilhamento pronto, sem depender de API paga.
- Para deploy, configure a variável `DATABASE_URL` ou edite diretamente o `server/database.js` com os dados do banco.

---

## Teste manual sugerido

**Cenário 1 — cliente**
1. Escolher Combo Corte + Barba
2. Clicar em um dia disponível
3. Verificar que o sistema esconde horários que não cabem na duração
4. Finalizar o agendamento
5. Abrir `/perfil` e consultar a reserva com e-mail + telefone

**Cenário 2 — admin**
1. Entrar no `/admin`
2. Bloquear um horário por 90 min
3. Voltar para `/agendar`
4. Validar que os slots afetados sumiram para serviços compatíveis
5. Confirmar um agendamento pendente

---

## Notificação ao confirmar agendamento

Na versão atual, ao confirmar um agendamento no painel admin, o sistema já abre o WhatsApp Web com a mensagem pronta para avisar o cliente. Isso evita que o cliente fique sem retorno após a aprovação.

**Fluxo:**
1. Cliente faz o agendamento
2. Status inicial fica como `pendente`
3. Admin clica em Confirmar
4. O sistema muda para `confirmado`
5. O WhatsApp abre com a mensagem pronta para envio

Também existe o botão WhatsApp na tabela para reenviar a confirmação depois.

> Observação: o envio é semi-automático via WhatsApp Web. Não usa API oficial do WhatsApp, então não dispara sozinho em segundo plano.

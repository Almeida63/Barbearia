# BarberGold — sistema de barbearia com agenda visual

Projeto full stack com:

- Frontend em HTML5, CSS3 e JavaScript Vanilla
- Backend em Node.js + Express
- Banco SQLite3 com migrations
- Tema dark em preto/dourado
- URL local: `http://localhost:3000`

## O que mudou nesta versão

Esta versão ficou mais prática para o cliente:

- sem login e sem cadastro obrigatório
- agenda visual com os próximos dias disponíveis
- horários calculados conforme a duração do serviço
- compartilhamento rápido do agendamento no WhatsApp
- painel admin com bloqueio por duração (`30/60/90/120 min`)
- pronto para deploy porque usa `process.env.PORT`

## Estrutura

```bash
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
│   ├── migrate.js
│   ├── seed.js
│   ├── migrations/
│   │   ├── 001_init.sql
│   │   └── 002_block_duration.sql
│   ├── routes/
│   │   ├── authRoutes.js
│   │   └── bookingRoutes.js
│   └── models/
├── package.json
├── README.md
└── database.sqlite
```

## Como rodar

```bash
npm install
npm run migrate
npm run seed
npm start
```

Abra no navegador:

```bash
http://localhost:3000
```

## Credenciais do admin

- E-mail: `admin@barbearia.com`
- Senha: `admin123`

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

## Fluxo do admin

1. Acesse `/admin`
2. Faça login com as credenciais padrão
3. Veja todos os agendamentos
4. Confirme ou remova reservas
5. Bloqueie horários com duração personalizada
6. Acompanhe os clientes cadastrados

## Rotas principais

### Páginas
- `GET /`
- `GET /servicos`
- `GET /agendar`
- `GET /perfil`
- `GET /admin`

### API
- `POST /api/auth/admin/login`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/services`
- `GET /api/available-times?date=YYYY-MM-DD&servico_id=ID`
- `POST /api/appointments-public`
- `GET /api/public-appointments?email=...&telefone=...`
- `DELETE /api/public-appointments/:id`
- `GET /api/admin/appointments`
- `GET /api/admin/customers`
- `PATCH /api/admin/appointments/:id/confirm`
- `DELETE /api/admin/appointments/:id`
- `POST /api/admin/block`
- `GET /api/admin/blocked`
- `DELETE /api/admin/blocked/:id`

## Observações práticas

- O sistema considera atendimento entre `09:00` e `20:00`.
- Um serviço de `60 min` ocupa dois slots de `30 min`.
- Um bloqueio admin de `120 min` também trava quatro slots.
- O botão de WhatsApp usa link de compartilhamento pronto, sem depender de API paga.
- Para deploy, basta instalar dependências, rodar migration/seed e iniciar com `npm start`.

## Teste manual sugerido

### Cenário 1 — cliente
- escolher `Combo Corte + Barba`
- clicar em um dia disponível
- verificar que o sistema esconde horários que não cabem na duração
- finalizar o agendamento
- abrir `/perfil` e consultar a reserva com e-mail + telefone

### Cenário 2 — admin
- entrar no `/admin`
- bloquear um horário por `90 min`
- voltar para `/agendar`
- validar que os slots afetados sumiram para serviços compatíveis
- confirmar um agendamento pendente

## Screenshots mentais

- Home: hero grande, preto/dourado, CTA forte e cards com hover.
- Agendar: bloco lateral com agenda visual por dias e bloco principal com formulário premium.
- Sucesso: cartão verde elegante com protocolo e botão de WhatsApp.
- Admin: painel escuro com tabelas, duração dos serviços e bloqueios por intervalo.

## Observação honesta

A estrutura e a sintaxe dos arquivos foram validadas localmente, mas a instalação real das dependências (`npm install`) precisa ser feita no seu computador para subir o servidor.


## Notificação ao confirmar agendamento

Na versão atual, ao confirmar um agendamento no painel admin, o sistema já abre o **WhatsApp Web** com a mensagem pronta para avisar o cliente. Isso evita que o cliente fique sem retorno após a aprovação.

Fluxo:
1. Cliente faz o agendamento
2. Status inicial fica como `pendente`
3. Admin clica em **Confirmar**
4. O sistema muda para `confirmado`
5. O WhatsApp abre com a mensagem pronta para envio

Também existe o botão **WhatsApp** na tabela para reenviar a confirmação depois.

> Observação: o envio é semi-automático via WhatsApp Web. Não usa API oficial do WhatsApp, então não dispara sozinho em segundo plano.

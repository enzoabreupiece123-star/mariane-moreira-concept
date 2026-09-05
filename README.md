# Mariane Moreira Concept
E-commerce full-stack para boutique de moda feminina, com loja pública, carrinho, cupons, estoque, pedidos e painel administrativo.

## Requisitos
- Node.js 20+
- npm 10+

## Instalação
1. `npm install`
2. Copie `.env.example` para `.env` e altere `JWT_SECRET` e `ADMIN_PASSWORD`.
3. `npm run seed` (opcional; cria dados demonstrativos e administrador caso não existam).
4. `npm start`
5. Abra `http://localhost:3000`.
6. Painel: `http://localhost:3000/admin/`.

## Administrador
As credenciais vêm das variáveis `ADMIN_EMAIL` e `ADMIN_PASSWORD`. O seed cria o usuário somente se ele ainda não existir.

## WhatsApp
O número fica centralizado em `WHATSAPP` no `.env` e também é refletido em Configurações no painel. O checkout monta a mensagem e abre `https://wa.me/<numero>?text=...`.

## Banco
SQLite em `data/store.db`, criado automaticamente. Não é necessário instalar servidor de banco separado.

## Imagens
Uploads ficam em `uploads/` e são servidos em `/uploads`. A galeria aceita múltiplas imagens e uma imagem principal.

## Publicação
Use um servidor Node (Render, Railway, VPS etc.) com armazenamento persistente para `data/` e `uploads/`. Configure as variáveis de ambiente e execute `npm install && npm start`. Para domínio próprio, aponte DNS para o servidor e use HTTPS/reverse proxy.

## Funcionalidades
- Home editável
- Categorias e coleções
- Busca, filtros e ordenação
- Produtos com variantes de tamanho/cor e estoque por combinação
- Galeria de imagens
- Carrinho persistente no navegador
- Cupons
- Checkout e pedido por WhatsApp
- Pedidos e status
- Dashboard administrativo
- Gestão de produtos, categorias, cupons, campanhas e configurações
- Autenticação com JWT + bcrypt
- Helmet, validações básicas e proteção de rotas administrativas

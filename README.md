KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=admin_local_dev

Usuario `demo-user` 
Password `demo-user-local-dev` 

# SFA POC

Prueba de concepto para explorar seguridad en APIs financieras: **Keycloak** como Authorization Server, flujos **OAuth 2.0 / OIDC**, **PAR**, **PKCE** y preparación para **FAPI**, **mTLS** y **TLS 1.3**.

## Componentes

| Componente | Descripción | Documentación |
|---|---|---|
| Keycloak + PostgreSQL | Authorization Server en Docker Desktop (localhost) | [keycloak/README.md](keycloak/README.md) |
| TPP Client | Cliente Node.js (Authorization Code + PAR + PKCE + DPoP) | [tpp-client/README.md](tpp-client/README.md) |
| Resource Server | API NestJS protegida con JWT DPoP-bound (`GET /cities`) | [resource_server/README.md](resource_server/README.md) |

## Inicio rápido

```bash
# 1. Levantar Keycloak (ver keycloak/README.md para configuración de .env)
docker compose up -d

# 2. Resource Server (requiere Node 20+)
cd resource_server
cp .env.example .env   # si aún no existe
nvm use
npm install            # solo la primera vez
npm run start:dev

# 3. Cliente TPP — obtener access_token DPoP-bound (requiere Node 20+)
cd tpp-client
cp .env.example .env   # si aún no existe
# Opcional: RESOURCE_SERVER_URL=http://localhost:9090/cities
nvm use
npm start

# 4. Consultar ciudades (el TPP client lo hace solo si RESOURCE_SERVER_URL está definido)
# Manualmente requiere Authorization: DPoP + header DPoP — ver resource_server/README.md
```

## Requisitos generales

- Docker Desktop en ejecución
- Node.js **20+** (ver `tpp-client/.nvmrc`)
- Puertos libres: `8080`, `9000`, `3000`, `9090`

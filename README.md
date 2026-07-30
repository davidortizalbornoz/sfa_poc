# SFA POC

Prueba de concepto para explorar seguridad en APIs financieras: **Keycloak** como Authorization Server, flujos **OAuth 2.0 / OIDC**, **PAR**, **PKCE** y preparación para **FAPI**, **mTLS** y **TLS 1.3**.

## Componentes

| Componente | Descripción | Documentación |
|---|---|---|
| Keycloak + PostgreSQL (sfa-poc) | Authorization Server en Docker Desktop (localhost:8080) | [keycloak/README.md](keycloak/README.md) |
| Keycloak + PostgreSQL (bci-idp) | Identity Provider BCI en Docker Desktop (127.0.0.1:5050) | — |
| TPP Client | Cliente Node.js (Authorization Code + PAR + PKCE + DPoP) | [tpp-client/README.md](tpp-client/README.md) |
| Resource Server | API NestJS protegida con JWT DPoP-bound (`GET /cities`) | [resource_server/README.md](resource_server/README.md) |

## Configuración

En la raíz del repositorio, el archivo `.env` define las variables de ambos entornos Keycloak. Cada stack usa variables con prefijo explícito para evitar conflictos:

| Entorno | Archivo compose | Variables |
|---|---|---|
| **sfa-poc** | `docker-compose.yml` | `POSTGRES_*`, `KC_*` |
| **bci-idp** | `docker-compose.bci-idp.yml` | `BCI_POSTGRES_*`, `BCI_KC_*` |

## Entorno sfa-poc

Authorization Server principal con realm `sfa-poc`, features **PAR** y **DPoP**.

```bash
# Levantar
docker compose up -d

# Ver logs
docker compose logs -f keycloak

# Reiniciar
docker compose restart

# Bajar (conserva datos)
docker compose down

# Bajar y eliminar volúmenes
docker compose down -v
```

- **Consola admin:** http://localhost:8080/admin
- **Realm:** `sfa-poc`
- **Health check:** http://localhost:9000/health/ready
- **Identity Provider:** `bci-idp` (OIDC → `http://127.0.0.1:5050/realms/bci-idp`)

> Accede siempre por **`localhost`**, no por `127.0.0.1`, para mantener la sesión aislada de bci-idp.

## Entorno bci-idp

Identity Provider BCI con realm `bci-idp`, pensado para integrarse como IdP externo en sfa-poc. Corre en paralelo sin compartir base de datos ni puertos.

```bash
# Levantar
docker compose -f docker-compose.bci-idp.yml up -d

# Ver logs
docker compose -f docker-compose.bci-idp.yml logs -f keycloak

# Reiniciar
docker compose -f docker-compose.bci-idp.yml restart

# Bajar (conserva datos)
docker compose -f docker-compose.bci-idp.yml down

# Bajar y eliminar volúmenes
docker compose -f docker-compose.bci-idp.yml down -v
```

- **Consola admin:** http://127.0.0.1:5050/admin
- **Realm:** `bci-idp`
- **Health check:** http://127.0.0.1:9050/health/ready

> Accede siempre por **`127.0.0.1`**, no por `localhost`, para mantener la sesión aislada de sfa-poc.

### Usuarios de prueba (bci-idp)

| Usuario | Contraseña | Grupo |
|---|---|---|
| `demo-user` | `demo-user-local-dev` | `bci-users` |
| `maria-gonzalez` | `maria-gonzalez-local-dev` | `bci-users` |
| `juan-perez` | `juan-perez-local-dev` | `bci-users` |
| `ana-rodriguez` | `ana-rodriguez-local-dev` | `bci-users` |
| `carlos-silva` | `carlos-silva-local-dev` | `bci-users` |


Puertos utilizados:

| Entorno | Hostname | HTTP | Health/Metrics |
|---|---|---|---|
| sfa-poc | `localhost` | 8080 | 9000 |
| bci-idp | `127.0.0.1` | 5050 | 9050 |

## Convivencia de sesiones

Los navegadores **no distinguen puertos** al enviar cookies: dos Keycloak en `localhost:8080` y `localhost:5050` comparten cookies de sesión y se invalidan mutuamente al iniciar sesión en uno u otro.

Solución aplicada: cada instancia usa un **dominio distinto**:

- **sfa-poc** → `http://localhost:8080`
- **bci-idp** → `http://127.0.0.1:5050`

Usa siempre la URL indicada para cada entorno (admin, login, discovery). No mezcles `localhost` y `127.0.0.1` para el mismo stack.

## Account console con usuarios BCI (ana-rodriguez)

Los usuarios BCI (`ana-rodriguez`, `maria-gonzalez`, etc.) **solo tienen contraseña en bci-idp**, no en sfa-poc. No uses el formulario local de sfa-poc con esas credenciales.

Flujo correcto para http://localhost:8080/realms/sfa-poc/account:

1. Abre la URL en el navegador.
2. En la pantalla de login de sfa-poc, haz clic en **BCI IDP**.
3. Inicia sesión en bci-idp (`127.0.0.1:5050`), por ejemplo:
   - Usuario: `ana-rodriguez`
   - Contraseña: `ana-rodriguez-local-dev`
4. Tras el login, vuelves a la Account console de sfa-poc con el usuario federado.

Para login local en sfa-poc (flujo TPP, `tpp-demo`), usa usuarios del realm sfa-poc como `demo-user`.

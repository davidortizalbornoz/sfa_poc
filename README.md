# SFA POC

Prueba de concepto para explorar seguridad en APIs financieras: **Keycloak** como Authorization Server, flujos **OAuth 2.0 / OIDC**, **PAR**, **PKCE** y preparación para **FAPI**, **mTLS** y **TLS 1.3**.

## Componentes

| Componente | Descripción | Documentación |
|---|---|---|
| Keycloak + PostgreSQL (sfa-poc) | Authorization Server local (`sfa.localtest.me:8080`) | [keycloak/README.md](keycloak/README.md) |
| Keycloak + PostgreSQL (bci-idp) | Identity Provider BCI remoto (`10.67.245.106:5050`) | — |
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

- **Consola admin:** http://sfa.localtest.me:8080/admin
- **Realm:** `sfa-poc`
- **Health check:** http://localhost:9000/health/ready
- **Identity Provider:** `bci-idp` (OIDC → `http://10.67.245.106:5050/realms/bci-idp`)

> Para flujos con **BCI IDP** (Account console, broker), usa **`http://sfa.localtest.me:8080`** en lugar de `localhost`. Keycloak 26 en `localhost` emite cookies `SameSite=None; Secure` que no sobreviven el redirect al IdP remoto (*Restart login cookie not found*). `sfa.localtest.me` resuelve a 127.0.0.1 vía DNS público.
>

## Entorno bci-idp (remoto)

Identity Provider BCI con realm `bci-idp`, desplegado en **`10.67.245.106:5050`**. No corre en este repositorio de forma local; se integra como IdP externo en sfa-poc.

- **Consola admin:** http://10.67.245.106:5050/admin
- **Realm:** `bci-idp`
- **Discovery:** http://10.67.245.106:5050/realms/bci-idp/.well-known/openid-configuration

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
| sfa-poc | `sfa.localtest.me` (broker/account) · `localhost` (TPP/discovery) | 8080 | 9000 |
| bci-idp | `10.67.245.106` (remoto) | 5050 | — |

## Convivencia de sesiones

**bci-idp** corre en un host remoto (`10.67.245.106:5050`), por lo que no comparte cookies con sfa-poc.

Para el flujo broker (Account console → BCI IDP), sfa-poc debe abrirse en **`http://sfa.localtest.me:8080`**, no en `localhost:8080` (ver nota arriba sobre cookies Keycloak 26).

## Account console con usuarios BCI (ana-rodriguez)

Los usuarios BCI (`ana-rodriguez`, `maria-gonzalez`, etc.) **solo tienen contraseña en bci-idp**, no en sfa-poc. No uses el formulario local de sfa-poc con esas credenciales.

Flujo correcto para http://sfa.localtest.me:8080/realms/sfa-poc/account:

1. Abre la URL en el navegador (**`sfa.localtest.me`**, no `localhost`).
2. En la pantalla de login de sfa-poc, haz clic en **BCI IDP**.
3. Inicia sesión en bci-idp (`10.67.245.106:5050`), por ejemplo:
   - Usuario: `ana-rodriguez`
   - Contraseña: `ana-rodriguez-local-dev`
4. Tras el login, vuelves a la Account console de sfa-poc con el usuario federado.

Para login local en sfa-poc (flujo TPP, `tpp-demo`), usa usuarios del realm sfa-poc como `demo-user`.

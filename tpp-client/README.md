# TPP Client — Authorization Code + PAR + PKCE + DPoP

Cliente de línea de comandos en **Node.js + TypeScript** que simula un **Third Party Provider (TPP)** contra Keycloak.

Implementa el flujo:

1. **DPoP** — genera par de claves ES256 y calcula `dpop_jkt`
2. **PAR** — envía parámetros de autorización (incluye `dpop_jkt`) al endpoint `/ext/par/request`
3. **Authorization Code** — abre el navegador para login y consentimiento
4. **PKCE (S256)** — intercambia el `code` por tokens con `code_verifier` y header `DPoP`
5. **Resource Server** (opcional) — llama un endpoint protegido con `Authorization: DPoP`

## Requisitos

- **Keycloak en ejecución** (ver [keycloak/README.md](../keycloak/README.md))
- **Node.js 20+** (LTS recomendado)
- **nvm** (opcional, recomendado): el proyecto incluye `.nvmrc` con versión `20`
- Puerto **3000** libre para el callback OAuth

Verificar Node:

```bash
node --version   # debe ser v20.x o superior
```

Activar Node 20 con nvm:

```bash
cd tpp-client
nvm use
```

## Configuración

Copia la plantilla de entorno si aún no tienes `.env`:

```bash
cd tpp-client
cp .env.example .env
```

Variables por defecto (`.env`):

| Variable | Valor | Descripción |
|---|---|---|
| `KEYCLOAK_BASE_URL` | `http://localhost:8080` | URL base de Keycloak |
| `KEYCLOAK_REALM` | `sfa-poc` | Realm importado |
| `CLIENT_ID` | `tpp-demo` | Cliente OAuth confidential |
| `CLIENT_SECRET` | `tpp-demo-secret-local-dev` | Secret del cliente |
| `REDIRECT_URI` | `http://localhost:3000/callback` | URI registrada en Keycloak |
| `SCOPE` | `openid profile email accounts:read` | Scopes solicitados |
| `CALLBACK_HOST` | `localhost` | Host del servidor callback |
| `CALLBACK_PORT` | `3000` | Puerto del servidor callback |
| `RESOURCE_SERVER_URL` | *(vacío)* | URL opcional del API protegido (ej. `http://localhost:9090/cities`) |
| `M2M_CLIENT_ID` | `tpp-demo-m2m` | Cliente M2M (`npm run m2m`) |
| `M2M_CLIENT_SECRET` | `tpp-demo-m2m-secret-local-dev` | Secret del cliente M2M |
| `M2M_SCOPE` | `accounts:read` | Scope para `client_credentials` |

> Keycloak exige DPoP para el cliente `tpp-demo` (`dpop.bound.access.tokens=true`). El script genera claves ES256 en memoria en cada ejecución.

## Ejecución

Desde el directorio `tpp-client`:

```bash
cd tpp-client
nvm use          # recomendado: activa Node 20 desde .nvmrc
npm install      # solo la primera vez (TypeScript + tsx)
npm start
```

Alias equivalente:

```bash
npm run auth
```

### Flujo M2M (`client_credentials` + DPoP)

Para el cliente `tpp-demo-m2m` (sin navegador ni usuario):

```bash
npm run m2m
```

El script:

1. Genera claves **DPoP (ES256)** y el proof para `POST /token`.
2. Imprime el **curl** listo para copiar.
3. Obtiene el **access_token** con `grant_type=client_credentials`.
4. Imprime el **curl** para llamar al Resource Server con `Authorization: DPoP`.

Variables M2M opcionales en `.env`: `M2M_CLIENT_ID`, `M2M_CLIENT_SECRET`, `M2M_SCOPE`.

### Qué ocurre al ejecutar

1. El script genera un par de claves **DPoP (ES256)** y calcula `dpop_jkt`.
2. Envía un **Pushed Authorization Request** a Keycloak (incluye `dpop_jkt`).
3. Levanta un servidor HTTP local en `http://localhost:3000/callback`.
4. Abre el navegador en la URL de autorización.
5. Tras login, Keycloak redirige al callback con un `authorization_code`.
6. Intercambia el code por **access_token** DPoP-bound (header `DPoP` en POST `/token`).
7. Imprime el **DPoP proof** y un **curl** listo para `GET /cities`.
8. Si `RESOURCE_SERVER_URL` está definido, llama al API con `Authorization: DPoP`.

### Credenciales en el navegador

| Campo | Valor |
|---|---|
| Usuario | `demo-user` |
| Password | `demo-user-local-dev` |

Acepta la pantalla de consentimiento cuando Keycloak la muestre.

### Salida esperada (extracto)

```text
=== Cliente TPP (Authorization Code + PAR + PKCE + DPoP) ===
...
DPoP jkt:   0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I
1/4 Enviando Pushed Authorization Request (PAR + dpop_jkt)...
2/4 Esperando callback OAuth...
3/4 Abriendo navegador para login/consentimiento...
4/4 Intercambiando code por tokens (header DPoP)...

=== Tokens obtenidos ===
token_type:     DPoP
expires_in:     300s
scope:          openid profile email accounts:read
access_token:   eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUI...

=== Payload JWT (sin verificar firma) ===
{
  "cnf": { "jkt": "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" },
  ...
}

=== DPoP proof para Resource Server ===
resource_url:   http://localhost:9090/cities
dpop_proof:     eyJ0eXAiOiJkcG9wK2p3dCIs...

=== curl GET /cities ===
curl -s http://localhost:9090/cities \
  -H "Authorization: DPoP eyJhbGciOiJSUzI1NiIs..." \
  -H "DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs..." \
  -H "Accept: application/json"

Flujo completado.
```

## Estructura del proyecto

```text
tpp-client/
├── .env              # Configuración local (no commitear secretos reales)
├── .env.example      # Plantilla
├── package.json
├── tsconfig.json
└── src/
    ├── types.ts      # Tipos compartidos (config, OAuth, DPoP)
    ├── config.ts     # Carga de variables y URLs OIDC
    ├── dpop.ts       # Claves ES256, dpop_jkt y proofs DPoP
    ├── pkce.ts       # Generación PKCE + state
    ├── m2m-token.ts  # client_credentials + DPoP (tpp-demo-m2m)
    └── index.ts      # Flujo PAR → browser → token → API (opcional)
```

Dependencias de desarrollo: **TypeScript**, **tsx** (ejecución directa de `.ts`) y **@types/node**. En runtime usa **fetch** nativo y **`--env-file`** de Node 20+.

Compilar a JavaScript (opcional):

```bash
npm run build
npm run start:prod
```

## Solución de problemas

### `Falta la variable de entorno ...`

- Confirma que existe `tpp-client/.env` (copia desde `.env.example`).
- Ejecuta con `npm start` (incluye `--env-file=.env`).

### `PAR fallo` o `Token endpoint respondio error`

- Verifica que Keycloak esté arriba: `curl -s http://localhost:8080/realms/sfa-poc/.well-known/openid-configuration`
- Confirma `CLIENT_ID`, `CLIENT_SECRET` y `REDIRECT_URI` coinciden con el realm importado.
- Si el error menciona `dpop_jkt`, confirma que el cliente tiene `dpop.bound.access.tokens=true` y la client policy DPoP activa.

### `Resource Server respondio error`

- El Resource Server debe validar tokens DPoP (`Authorization: DPoP` + header `DPoP` + claim `cnf.jkt`).
- Si aún no está actualizado, deja `RESOURCE_SERVER_URL` vacío y valida solo el flujo OAuth.

### Puerto 3000 en uso

Cambia en `.env`:

```env
CALLBACK_PORT=3001
REDIRECT_URI=http://localhost:3001/callback
```

> Si cambias el redirect URI, también debes registrarlo en el cliente `tpp-demo` en Keycloak (realm JSON o Admin Console).

### Node.js demasiado antiguo

```bash
nvm install 20
nvm use 20
node --version
```

El proyecto requiere **Node >= 20** (`package.json` → `engines`).

### El navegador no se abre

Copia manualmente la URL que imprime el script en el paso `3/4` y ábrela en el navegador.

## Próximos pasos del POC

- Resource Server con validación DPoP (`cnf.jkt` + header `DPoP`)
- Cliente `tpp-demo-mtls` con certificados X509
- TLS 1.3 y mTLS en el canal de transporte



____



### 3. Usar PAR (Pushed Authorization Requests)
En lugar de mandar todos los parámetros en la URL del navegador, el TPP primero hace:

```http
POST /realms/sfa-poc/protocol/openid-connect/ext/par/request
```

Con:
- `client_id=tpp-demo`
- `client_secret=...`
- `response_type=code`
- `redirect_uri=http://localhost:3000/callback`
- `scope=openid accounts:read`
- `code_challenge` + `code_challenge_method=S256`

Keycloak responde con `request_uri` y el browser solo abre authorize con ese URI (más seguro, alineado a FAPI).

### 4. Abrir el navegador para login del usuario
El TPP no puede “inventar” el code: necesita que **demo-user** inicie sesión y apruebe el consentimiento en Keycloak.

Acciones:
- Abrir URL de autorización automáticamente
- Capturar el `code` en un callback local (`localhost:3000/callback`)

### 5. Intercambiar code por tokens
El TPP llama al token endpoint con:
- `grant_type=authorization_code`
- `code`
- `redirect_uri`
- `client_id` + `client_secret` (cliente confidential)
- `code_verifier` (PKCE)

Resultado: **access_token JWT** usable contra un Resource Server.


## Qué aprenderías con ese paso

1. Diferencia entre **autenticación del usuario** (login) y **autorización del cliente** (client_id/secret).
2. Cómo funciona **PKCE** (`code_verifier` / `code_challenge`).
3. Por qué **PAR** mejora seguridad en APIs financieras.
4. Cómo se ve un **access_token** real emitido por Keycloak.
5. Base para el siguiente paso: **mTLS** (`tpp-demo-mtls`) y **DPoP**.


cliente OAuth funcional que complete el flujo PAR → login → code PKCE (S256) → token, para validar que tu Authorization Server está bien configurado


# Instalación Authorization Server (Keycloak 26.2.5 (con setup FAPI 2.0 & DPoP Token))
# Instalación Authorization Server (Keycloak 26.2.5 (con setup básico de un Identity Provider))

# Flujo Client Credentials [Proof + TOKEN] -> Autenticación de Fintech's del directorio de participantes
# Verificación DPoP en ResourceServer -> Para Fintech del directorio de participantes & clientes de filiales federados

# Incorporación de un Identity Provider al Authorization Server para establecer Federación
# Flujo Authorization Code [PAR + LOGIN (Web) + (PKCE (S256) + [Proof + TOKEN])] -> Autenticación de usuarios federados
# Flujo de importación de usuarios federados al Authorization Server
# Flujo DCR (Dynamic Client Registration) con SSA (Software Statement Assertion)


Servicio	
PostgreSQL 16
Keycloak 26.2.5 (con algunas configuraciones FAPI & DPoP)

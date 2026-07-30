# Keycloak — Authorization Server

Entorno local de **Keycloak 26.2.5** con **PostgreSQL 16**, pensado para desarrollo en **localhost** con Docker Desktop.

## Qué incluye

- **Keycloak** como Authorization Server (OAuth 2.0 / OpenID Connect)
- **PostgreSQL** persistente (los datos sobreviven reinicios)
- Import automático del realm **`sfa-poc`** al arrancar
- Features habilitadas: **PAR** y **DPoP** (preparación FAPI)

## Requisitos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) en ejecución
- Puertos libres: **8080** (HTTP) y **9000** (health/metrics)
- RAM recomendada para Docker: **4 GB** o más

Verificar puerto 8080:

```bash
lsof -i :8080
```

## Configuración

En la raíz del repositorio, el archivo `.env` define las variables del stack:

```env
POSTGRES_DB=keycloak
POSTGRES_USER=keycloak
POSTGRES_PASSWORD=keycloak_local_dev

KC_BOOTSTRAP_ADMIN_USERNAME=admin
KC_BOOTSTRAP_ADMIN_PASSWORD=admin_local_dev

KC_HOSTNAME=http://sfa.localtest.me:8080
```

> Si no existe `.env`, créalo copiando los valores anteriores o desde un respaldo local del equipo.

## Arranque

Desde la raíz del repositorio:

```bash
cd /Users/Ext_DHOrtizA/BCI/SFA/repo/sfa_poc

# Descargar imágenes (primera vez)
docker compose pull

# Levantar servicios
docker compose up -d

# Ver logs de Keycloak (primer arranque ~60–90 s)
docker compose logs -f keycloak
```

## Verificación

### Estado de contenedores

```bash
docker compose ps
```

Ambos servicios deben estar `running` y `healthy`:

| Contenedor | Servicio | Puertos |
|---|---|---|
| `sfa-postgres` | PostgreSQL | 5432 (interno) |
| `sfa-keycloak` | Keycloak | 8080, 9000 |

### Health check

```bash
curl -s http://localhost:9000/health/ready | python3 -m json.tool
```

Respuesta esperada: `"status": "UP"`.

### Consola de administración

| Campo | Valor |
|---|---|
| URL | http://sfa.localtest.me:8080/admin |
| Usuario | `admin` |
| Password | `admin_local_dev` |

### OpenID Discovery (realm importado)

```bash
curl -s http://sfa.localtest.me:8080/realms/sfa-poc/.well-known/openid-configuration | python3 -m json.tool
```

## Realm `sfa-poc` (import automático)

El archivo `keycloak/import/sfa-poc-realm.json` se importa al iniciar Keycloak (`start-dev --import-realm`).

### Clientes OAuth

| Client ID | Tipo | Uso |
|---|---|---|
| `tpp-demo` | Confidential | Cliente principal del POC (PAR + PKCE + DPoP) |
| `tpp-demo-public` | Public | Authorization Code con PKCE sin secret |
| `tpp-demo-mtls` | X509 | Preparado para `tls_client_auth` |
| `tpp-demo-m2m` | Confidential + Service Account | `client_credentials` + DPoP (M2M, sin usuario) |
| `resource-server` | Bearer-only | Audience lógica del API protegido |

**Secret de `tpp-demo`:** `tpp-demo-secret-local-dev`

**Secret de `tpp-demo-m2m`:** `tpp-demo-m2m-secret-local-dev`

### Obtener token con `client_credentials` + DPoP (`tpp-demo-m2m`)

Con `dpop.bound.access.tokens=true`, Keycloak **rechaza** el token request si no incluye un header `DPoP` válido (JWT ES256 con `htm`, `htu` y `jwk`). La respuesta exitosa devuelve `token_type: DPoP` y un `access_token` con claim `cnf.jkt`.

Flujo:

1. Generar par de claves **ES256 (P-256)** en el cliente (misma lógica que `tpp-client/src/dpop.ts`).
2. Crear **DPoP proof** para `POST` al token endpoint (sin claim `ath`).
3. Enviar el token request con header `DPoP`.
4. Llamar al API con `Authorization: DPoP <access_token>` y un **nuevo** DPoP proof (con claim `ath`).

Ejemplo conceptual del token request (el proof debe generarse en código; no es práctico con curl plano):

```http
POST /realms/sfa-poc/protocol/openid-connect/token
Content-Type: application/x-www-form-urlencoded
DPoP: eyJ0eXAiOiJkcG9wK2p3dCIs...

grant_type=client_credentials
&client_id=tpp-demo-m2m
&client_secret=tpp-demo-m2m-secret-local-dev
&scope=accounts:read
```

> `tpp-demo` **no** soporta `client_credentials` (`serviceAccountsEnabled=false`). Usa `tpp-demo-m2m` para flujos machine-to-machine con DPoP.

### Usuarios de prueba

| Usuario | Password | Roles principales |
|---|---|---|
| `demo-user` | `demo-user-local-dev` | account-viewer, tpp-operator |
| `admin-poc` | `admin-poc-local-dev` | account-admin, account-viewer, tpp-operator |

### Scopes personalizados

- `accounts:read`
- `accounts:write`
- `payments:read`

## Endpoints útiles

| Endpoint | URL |
|---|---|
| Landing | http://sfa.localtest.me:8080 |
| Admin Console | http://sfa.localtest.me:8080/admin |
| Discovery | http://sfa.localtest.me:8080/realms/sfa-poc/.well-known/openid-configuration |
| Authorization | http://sfa.localtest.me:8080/realms/sfa-poc/protocol/openid-connect/auth |
| Token | http://sfa.localtest.me:8080/realms/sfa-poc/protocol/openid-connect/token |
| PAR | http://sfa.localtest.me:8080/realms/sfa-poc/protocol/openid-connect/ext/par/request |
| JWKS | http://sfa.localtest.me:8080/realms/sfa-poc/protocol/openid-connect/certs |

## Comandos habituales

```bash
# Parar servicios (conserva datos)
docker compose down

# Parar y borrar volúmenes (reset total de BD y realms importados)
docker compose down -v

# Reiniciar solo Keycloak
docker compose restart keycloak

# Logs en tiempo real
docker compose logs -f keycloak
```

## Reimportar el realm

Keycloak usa estrategia **`IGNORE_EXISTING`**: si el realm ya existe, **no sobrescribe** cambios del JSON.

Para aplicar modificaciones en `sfa-poc-realm.json` o `bci-idp-realm.json`:

**Opción A — Borrar solo el realm**

1. Entra a la consola admin del entorno correspondiente.
2. Selecciona el realm → **Realm settings** → **Action** → **Delete**
3. Reinicia Keycloak (el JSON se importa al arrancar).

**Opción B — Reset total (recomendado en desarrollo)**

```bash
docker compose down -v
docker compose up -d
```

Para bci-idp remoto, borra el realm desde http://10.67.245.106:5050/admin y reinicia el contenedor, o recrea el volumen en ese host.

## Solución de problemas

### Keycloak reinicia en loop

```bash
docker compose logs keycloak --tail 100
```

Causas frecuentes: poca memoria en Docker o PostgreSQL no disponible. Sube RAM en Docker Desktop (mín. 4 GB).

### Admin Console con errores de redirect

- **sfa-poc:** http://sfa.localtest.me:8080/admin — confirma `KC_HOSTNAME=http://sfa.localtest.me:8080` en `.env`
- **bci-idp (remoto):** http://10.67.245.106:5050/admin — confirma `BCI_KC_HOSTNAME=http://10.67.245.106:5050` en `.env`

### Account console: 403 en `userProfileMetadata`

Keycloak **26.2.x** no asigna scopes a los clientes built-in (`account-console`, etc.) cuando el JSON de import define `clientScopes` custom ([issue #10021](https://github.com/keycloak/keycloak/issues/10021)). Sin el scope **`roles`**, la Account console responde 403.

**Solución en `sfa-poc-realm.json`:** incluir los seis clientes built-in del realm (`account`, `account-console`, `admin-cli`, `broker`, `realm-management`, `security-admin-console`) con sus `defaultClientScopes` (`web-origins`, `acr`, `profile`, `roles`, `basic`, `email`). No basta con declarar solo `account-console` (provoca duplicate key al importar) ni confiar solo en `defaultDefaultClientScopes` del realm.

Si el realm se creó antes de esta corrección, reimporta con `docker compose down -v && docker compose up -d`.

### Puerto 8080 ocupado

Cambia el mapeo en `docker-compose.yml` (ej. `"8081:8080"`) y actualiza `KC_HOSTNAME` con el mismo hostname y puerto.

## Notas de seguridad

- El modo `start-dev` es **solo para desarrollo local**. No usar en producción.
- Las contraseñas del POC son de demostración. Cámbialas si expones el entorno fuera de localhost.

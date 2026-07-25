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

KC_HOSTNAME=http://localhost:8080
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
| URL | http://localhost:8080/admin |
| Usuario | `admin` |
| Password | `admin_local_dev` |

### OpenID Discovery (realm importado)

```bash
curl -s http://localhost:8080/realms/sfa-poc/.well-known/openid-configuration | python3 -m json.tool
```

## Realm `sfa-poc` (import automático)

El archivo `keycloak/import/sfa-poc-realm.json` se importa al iniciar Keycloak (`start-dev --import-realm`).

### Clientes OAuth

| Client ID | Tipo | Uso |
|---|---|---|
| `tpp-demo` | Confidential | Cliente principal del POC (PAR + PKCE) |
| `tpp-demo-public` | Public | Authorization Code con PKCE sin secret |
| `tpp-demo-mtls` | X509 | Preparado para `tls_client_auth` |
| `resource-server` | Bearer-only | Audience lógica del API protegido |

**Secret de `tpp-demo`:** `tpp-demo-secret-local-dev`

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
| Landing | http://localhost:8080 |
| Admin Console | http://localhost:8080/admin |
| Discovery | http://localhost:8080/realms/sfa-poc/.well-known/openid-configuration |
| Authorization | http://localhost:8080/realms/sfa-poc/protocol/openid-connect/auth |
| Token | http://localhost:8080/realms/sfa-poc/protocol/openid-connect/token |
| PAR | http://localhost:8080/realms/sfa-poc/protocol/openid-connect/ext/par/request |
| JWKS | http://localhost:8080/realms/sfa-poc/protocol/openid-connect/certs |

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

Keycloak usa estrategia **`IGNORE_EXISTING`**: si el realm `sfa-poc` ya existe, **no sobrescribe** cambios del JSON.

Para aplicar modificaciones en `sfa-poc-realm.json`:

**Opción A — Borrar solo el realm**

1. Entra a http://localhost:8080/admin
2. Selecciona realm `sfa-poc` → **Realm settings** → **Action** → **Delete**
3. Reinicia Keycloak:

```bash
docker compose restart keycloak
```

**Opción B — Reset total**

```bash
docker compose down -v
docker compose up -d
```

## Solución de problemas

### Keycloak reinicia en loop

```bash
docker compose logs keycloak --tail 100
```

Causas frecuentes: poca memoria en Docker o PostgreSQL no disponible. Sube RAM en Docker Desktop (mín. 4 GB).

### Admin Console con errores de redirect

- Accede siempre por http://localhost:8080/admin
- Confirma `KC_HOSTNAME=http://localhost:8080` en `.env`

### Puerto 8080 ocupado

Cambia el mapeo en `docker-compose.yml` (ej. `"8081:8080"`) y actualiza `KC_HOSTNAME=http://localhost:8081`.

## Notas de seguridad

- El modo `start-dev` es **solo para desarrollo local**. No usar en producción.
- Las contraseñas del POC son de demostración. Cámbialas si expones el entorno fuera de localhost.

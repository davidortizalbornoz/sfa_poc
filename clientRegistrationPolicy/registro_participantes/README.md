# Registro de participantes (POC local)

Material criptográfico y artefactos de prueba que simulan el **Directorio de participantes** del ecosistema de Finanzas Abiertas (CMF Chile). En producción, el Directorio emite **Software Statements (SSA)** firmados y publica su **JWKS** para que los Authorization Servers verifiquen esas firmas durante el **Dynamic Client Registration (DCR)**.

Este directorio **no** contiene las claves de los TPP (Third Party Providers). Las JWKS de clientes registrados viven en [`../client-jwks/`](../client-jwks/).

## Recursos

| Archivo | Qué representa | Uso en el POC |
|---|---|---|
| `directory-private.pem` | Clave privada RSA del Directorio (solo desarrollo). Firma los JWT de Software Statement. | Script [`../scripts/generate-test-ssa.sh`](../scripts/generate-test-ssa.sh) y tests unitarios (`TestSoftwareStatementFactory`). **No exponer fuera del entorno local.** |
| `directory-public.pem` | Clave pública RSA correspondiente al par anterior. | Respaldo opcional (`directory-public-key-pem`) si Keycloak no puede cargar el JWKS por URI. |
| `directory-jwks.json` | Conjunto de claves públicas (JWKS) que el Directorio publicaría en `.well-known/jwks.json`. Incluye `kid: sfa-poc-directory-1` y algoritmo `PS256`. | Montado en Keycloak vía `docker-compose.yml` como `file:/opt/keycloak/data/test-directory-jwks.json`; referenciado en la policy `directory-jwks-uri` del realm `sfa-poc`. |
| `sample-software-statement.jwt` | JWT de ejemplo (Software Statement) firmado con `directory-private.pem`. Claims típicos: `iss`, `software_id`, `organisation_id`, `software_jwks_uri`, `redirect_uris`, etc. | Referencia rápida para pruebas manuales de DCR; se puede regenerar con `generate-test-ssa.sh`. |

## Variables del SSA (`ssa.env`)

Los claims del Software Statement se configuran en [`../ssa.env.example`](../ssa.env.example) (raíz de `clientRegistrationPolicy/`):

| Archivo | Descripción |
|---|---|
| `ssa.env.example` | Valores por defecto del POC (versionado) |
| `ssa.env` | Overrides locales (opcional, ignorado por git) |

Variables disponibles:

| Variable | Claim JWT |
|---|---|
| `SSA_ISSUER` | `iss` |
| `SSA_SOFTWARE_ID` | `software_id` |
| `SSA_ORGANISATION_ID` | `organisation_id` |
| `SSA_SOFTWARE_JWKS_URI` | `software_jwks_uri` |
| `SSA_SOFTWARE_CLIENT_NAME` | `software_client_name` |
| `SSA_REDIRECT_URIS` | `redirect_uris` (URIs separadas por coma) |
| `SSA_SOFTWARE_VERSION` | `software_version` |
| `SSA_JWT_KID` | `kid` del header (debe coincidir con `directory-jwks.json`) |

Para personalizar:

```bash
cp ssa.env.example ssa.env
# editar ssa.env
```

Ruta alternativa: `SSA_ENV=/ruta/custom.env ./scripts/generate-test-ssa.sh`

## Regenerar artefactos del participante

Desde `clientRegistrationPolicy/`:

```bash
# JWKS del TPP embebido en DCR (client-jwks/{SSA_SOFTWARE_ID}/jwks.json)
./scripts/generate-client-jwks.sh

# Software Statement firmado por el Directorio
./scripts/generate-test-ssa.sh
```

Si no existe `ssa.env`, los scripts usan `ssa.env.example`.

`generate-client-jwks.sh` genera un par RSA nuevo en cada ejecución (JWKS y `kid` distintos). La clave privada queda en `client-jwks/{SSA_SOFTWARE_ID}/private.pem` (ignorada por git).

Requisito: `pip install cryptography`.

## Relación con Keycloak

En el realm importado `sfa-poc`, la Client Registration Policy **SFA Software Statement** valida la firma del SSA contra `directory-jwks.json` y aplica los claims al cliente OAuth registrado dinámicamente.

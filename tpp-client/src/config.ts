import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { AppConfig, FintechAConfig, M2mConfig } from "./types.js";

interface JwksFile {
  keys?: Array<{ kid?: string; use?: string; alg?: string }>;
}

const TPP_CLIENT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CLIENT_JWKS_ROOT = join(
  TPP_CLIENT_ROOT,
  "../clientRegistrationPolicy/client-jwks",
);

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

function loadKidFromJwks(jwksPath: string): string {
  const jwks = JSON.parse(readFileSync(jwksPath, "utf8")) as JwksFile;
  const keys = jwks.keys ?? [];
  const signingKey =
    keys.find((key) => key.use === "sig" && key.kid) ??
    keys.find((key) => key.alg === "PS256" && key.kid) ??
    keys.find((key) => key.kid);

  if (!signingKey?.kid) {
    throw new Error(`JWKS sin kid utilizable en ${jwksPath}`);
  }

  return signingKey.kid;
}

export function loadConfig(): AppConfig {
  const baseUrl = required("KEYCLOAK_BASE_URL").replace(/\/$/, "");
  const realm = required("KEYCLOAK_REALM");

  return {
    baseUrl,
    realm,
    clientId: required("CLIENT_ID_IDP"),
    clientSecret: required("CLIENT_SECRET_IDP"),
    redirectUri: required("REDIRECT_URI"),
    scope: process.env.SCOPE_IDP ?? "openid profile email accounts:read",
    callbackHost: process.env.CALLBACK_HOST ?? "localhost",
    callbackPort: Number(process.env.CALLBACK_PORT ?? "3000"),
    resourceServerUrl: process.env.RESOURCE_SERVER_URL ?? "",
    endpoints: {
      par: `${baseUrl}/realms/${realm}/protocol/openid-connect/ext/par/request`,
      authorize: `${baseUrl}/realms/${realm}/protocol/openid-connect/auth`,
      token: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
      discovery: `${baseUrl}/realms/${realm}/.well-known/openid-configuration`,
    },
  };
}

export function loadM2mConfig(): M2mConfig {
  const baseUrl = required("KEYCLOAK_BASE_URL").replace(/\/$/, "");
  const realm = required("KEYCLOAK_REALM");

  return {
    baseUrl,
    realm,
    clientId: process.env.M2M_CLIENT_ID ?? "tpp-demo-m2m",
    clientSecret:
      process.env.M2M_CLIENT_SECRET ?? "tpp-demo-m2m-secret-local-dev",
    scope: process.env.M2M_SCOPE ?? "accounts:read",
    resourceServerUrl: process.env.RESOURCE_SERVER_URL ?? "",
    tokenEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
  };
}

export function loadFintechAConfig(): FintechAConfig {
  const baseUrl = required("KEYCLOAK_BASE_URL").replace(/\/$/, "");
  const realm = required("KEYCLOAK_REALM");
  const clientId = required("FINTECH_CLIENT_ID");
  const clientJwksDir = join(CLIENT_JWKS_ROOT, clientId);
  const jwksPath =
    process.env.FINTECH_JWKS_PATH ?? join(clientJwksDir, "jwks.json");
  const kid = process.env.FINTECH_KID ?? loadKidFromJwks(jwksPath);

  return {
    baseUrl,
    realm,
    clientId,
    scope: process.env.FINTECH_SCOPE ?? "accounts:read",
    kid,
    privateKeyPath:
      process.env.FINTECH_PRIVATE_KEY_PATH ??
      join(clientJwksDir, "private.pem"),
    jwksPath,
    resourceServerUrl:
      process.env.FINTECH_RESOURCE_SERVER_URL ??
      process.env.RESOURCE_SERVER_URL ??
      "http://localhost:9090/cities",
    tokenEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
  };
}

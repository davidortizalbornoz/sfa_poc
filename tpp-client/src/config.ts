import type { AppConfig, FintechAConfig, M2mConfig } from "./types.js";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
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

  return {
    baseUrl,
    realm,
    clientId: required("FINTECH_A_CLIENT_ID"),
    scope: process.env.FINTECH_A_SCOPE ?? "accounts:read",
    kid: required("FINTECH_A_KID"),
    privateKeyPath: required("FINTECH_A_PRIVATE_KEY_PATH"),
    jwksPath: process.env.FINTECH_A_JWKS_PATH ?? "keys/fintech-a/jwks.json",
    resourceServerUrl:
      process.env.FINTECH_A_RESOURCE_SERVER_URL ??
      process.env.RESOURCE_SERVER_URL ??
      "http://localhost:9090/cities",
    tokenEndpoint: `${baseUrl}/realms/${realm}/protocol/openid-connect/token`,
  };
}

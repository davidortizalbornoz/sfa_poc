function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}`);
  }
  return value;
}

export function loadConfig() {
  const baseUrl = required("KEYCLOAK_BASE_URL").replace(/\/$/, "");
  const realm = required("KEYCLOAK_REALM");

  return {
    baseUrl,
    realm,
    clientId: required("CLIENT_ID"),
    clientSecret: required("CLIENT_SECRET"),
    redirectUri: required("REDIRECT_URI"),
    scope: process.env.SCOPE ?? "openid profile email accounts:read",
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

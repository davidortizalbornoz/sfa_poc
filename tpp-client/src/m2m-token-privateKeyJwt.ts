import {
  createClientAssertion,
  loadPrivateKeyFromPath,
} from "./client-assertion.js";
import { loadFintechAConfig } from "./config.js";
import { createDpopKeyPair, createDpopProof } from "./dpop.js";
import type { DpopKeyPair, JwtPayload, TokenResponse } from "./types.js";

function decodeJwtPayload(token: string): JwtPayload | null {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  return JSON.parse(
    Buffer.from(payload, "base64url").toString("utf8"),
  ) as JwtPayload;
}

function createTokenDpopProof(
  dpopKeys: DpopKeyPair,
  tokenEndpoint: string,
  nonce?: string,
): string {
  return createDpopProof({
    privateKey: dpopKeys.privateKey,
    publicJwk: dpopKeys.publicJwk,
    method: "POST",
    url: tokenEndpoint,
    nonce,
  });
}

function printTokenCurl(
  tokenEndpoint: string,
  clientId: string,
  scope: string,
  clientAssertion: string,
  dpopProof: string,
): void {
  console.log(
    "=== curl POST /token (client_credentials + private_key_jwt PS256 + DPoP) ===",
  );
  console.log(`curl -s -X POST '${tokenEndpoint}' \\`);
  console.log(`  -H 'Content-Type: application/x-www-form-urlencoded' \\`);
  console.log(`  -H 'DPoP: ${dpopProof}' \\`);
  console.log(`  -d 'grant_type=client_credentials' \\`);
  console.log(`  -d 'client_id=${clientId}' \\`);
  console.log(
    `  -d 'client_assertion_type=urn:ietf:params:oauth:client-assertion-type:jwt-bearer' \\`,
  );
  console.log(`  -d 'client_assertion=${clientAssertion}' \\`);
  console.log(`  -d 'scope=${scope}'`);
  console.log("");
  console.log(
    "(El client_assertion y el proof DPoP son de un solo uso; ejecuta npm run fintech-a-m2m para generar nuevos.)",
  );
}

function printResourceServerCurl(
  accessToken: string,
  dpopProof: string,
  url: string,
): void {
  console.log("");
  console.log("=== curl GET Resource Server (Authorization: DPoP) ===");
  console.log(`curl -s '${url}' \\`);
  console.log(`  -H 'Authorization: DPoP ${accessToken}' \\`);
  console.log(`  -H 'DPoP: ${dpopProof}' \\`);
  console.log(`  -H 'Accept: application/json'`);
}

async function requestClientCredentialsToken(
  config: ReturnType<typeof loadFintechAConfig>,
  privateKey: ReturnType<typeof loadPrivateKeyFromPath>,
  dpopKeys: DpopKeyPair,
  initialProof: string,
): Promise<TokenResponse> {
  const clientAssertion = createClientAssertion({
    clientId: config.clientId,
    tokenEndpoint: config.tokenEndpoint,
    privateKey,
    kid: config.kid,
  });

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: config.clientId,
    client_assertion_type:
      "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: clientAssertion,
    scope: config.scope,
  });

  let dpopProof = initialProof;

  const response = await fetch(config.tokenEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      DPoP: dpopProof,
    },
    body,
  });

  const text = await response.text();
  let data: TokenResponse;

  try {
    data = JSON.parse(text) as TokenResponse;
  } catch {
    throw new Error(
      `Token endpoint respondio contenido no JSON (${response.status}): ${text}`,
    );
  }

  if (response.status === 401 && data.error === "use_dpop_nonce") {
    const nonce = response.headers.get("dpop-nonce") ?? undefined;
    dpopProof = createTokenDpopProof(dpopKeys, config.tokenEndpoint, nonce);

    const retryAssertion = createClientAssertion({
      clientId: config.clientId,
      tokenEndpoint: config.tokenEndpoint,
      privateKey,
      kid: config.kid,
    });

    const retryBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: config.clientId,
      client_assertion_type:
        "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: retryAssertion,
      scope: config.scope,
    });

    const retryResponse = await fetch(config.tokenEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
        DPoP: dpopProof,
      },
      body: retryBody,
    });

    const retryText = await retryResponse.text();
    try {
      data = JSON.parse(retryText) as TokenResponse;
    } catch {
      throw new Error(
        `Token endpoint respondio contenido no JSON (${retryResponse.status}): ${retryText}`,
      );
    }

    if (!retryResponse.ok) {
      throw new Error(
        `client_credentials fallo (${retryResponse.status}): ${data.error ?? "unknown"} - ${data.error_description ?? retryText}`,
      );
    }

    return data;
  }

  if (!response.ok) {
    throw new Error(
      `client_credentials fallo (${response.status}): ${data.error ?? "unknown"} - ${data.error_description ?? text}`,
    );
  }

  return data;
}

async function main(): Promise<void> {
  const config = loadFintechAConfig();
  const privateKey = loadPrivateKeyFromPath(config.privateKeyPath);
  const dpopKeys = createDpopKeyPair();
  const tokenProof = createTokenDpopProof(dpopKeys, config.tokenEndpoint);
  const clientAssertion = createClientAssertion({
    clientId: config.clientId,
    tokenEndpoint: config.tokenEndpoint,
    privateKey,
    kid: config.kid,
  });

  console.log("=== Cliente FINTECH-A (client_credentials + private_key_jwt PS256 + DPoP) ===");
  console.log(`Realm:      ${config.realm}`);
  console.log(`Client:     ${config.clientId}`);
  console.log(`Scope:      ${config.scope}`);
  console.log(`JWKS:       ${config.jwksPath} (embebido en Keycloak via DCR)`);
  console.log(`Key (kid):  ${config.kid}`);
  console.log(`DPoP jkt:   ${dpopKeys.dpopJkt}`);
  console.log("");
  console.log("=== client_assertion (PS256) para POST /token ===");
  console.log(`client_assertion: ${clientAssertion}`);
  console.log("");
  console.log("=== DPoP proof para POST /token ===");
  console.log(`dpop_proof:       ${tokenProof}`);
  console.log("");

  printTokenCurl(
    config.tokenEndpoint,
    config.clientId,
    config.scope,
    clientAssertion,
    tokenProof,
  );

  console.log("");
  console.log("Solicitando token con client_credentials + private_key_jwt...");
  const tokens = await requestClientCredentialsToken(
    config,
    privateKey,
    dpopKeys,
    tokenProof,
  );

  if (!tokens.access_token) {
    throw new Error("Token endpoint no devolvio access_token");
  }

  console.log("");
  console.log("=== Tokens obtenidos ===");
  console.log(`token_type:     ${tokens.token_type}`);
  console.log(`expires_in:     ${tokens.expires_in}s`);
  console.log(`scope:          ${tokens.scope ?? "(no reportado)"}`);
  console.log(`access_token:   ${tokens.access_token}`);

  const payload = decodeJwtPayload(tokens.access_token);
  console.log("");
  console.log("=== Payload JWT (sin verificar firma) ===");
  console.log(JSON.stringify(payload, null, 2));

  const resourceUrl = config.resourceServerUrl;
  const resourceProof = createDpopProof({
    privateKey: dpopKeys.privateKey,
    publicJwk: dpopKeys.publicJwk,
    method: "GET",
    url: resourceUrl,
    accessToken: tokens.access_token,
  });

  console.log("");
  console.log("=== DPoP proof para Resource Server ===");
  console.log(`resource_url:   ${resourceUrl}`);
  console.log(`dpop_proof:     ${resourceProof}`);

  printResourceServerCurl(tokens.access_token, resourceProof, resourceUrl);

  console.log("");
  console.log("Flujo FINTECH-A M2M completado.");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error("");
  console.error(`Error: ${message}`);
  process.exit(1);
});

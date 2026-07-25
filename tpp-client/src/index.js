import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "./config.js";
import { createDpopKeyPair, createDpopProof } from "./dpop.js";
import { createPkcePair, createState } from "./pkce.js";

const execFileAsync = promisify(execFile);

function decodeJwtPayload(token) {
  const [, payload] = token.split(".");
  if (!payload) {
    return null;
  }

  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

async function pushAuthorizationRequest(config, { codeChallenge, state, dpopJkt }) {
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    response_type: "code",
    redirect_uri: config.redirectUri,
    scope: config.scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    dpop_jkt: dpopJkt,
  });

  const response = await fetch(config.endpoints.par, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`PAR respondio contenido no JSON (${response.status}): ${text}`);
  }

  if (!response.ok) {
    throw new Error(
      `PAR fallo (${response.status}): ${data.error ?? "unknown"} - ${data.error_description ?? text}`
    );
  }

  if (!data.request_uri) {
    throw new Error(`PAR no devolvio request_uri: ${text}`);
  }

  return data;
}

function buildAuthorizeUrl(config, requestUri) {
  const url = new URL(config.endpoints.authorize);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("request_uri", requestUri);
  return url.toString();
}

async function exchangeCodeForTokens(config, { code, codeVerifier, dpopKeys }) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });

  const dpopProof = createDpopProof({
    privateKey: dpopKeys.privateKey,
    publicJwk: dpopKeys.publicJwk,
    method: "POST",
    url: config.endpoints.token,
  });

  const response = await fetch(config.endpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
      DPoP: dpopProof,
    },
    body,
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Token endpoint respondio contenido no JSON (${response.status}): ${text}`);
  }

  if (!response.ok) {
    throw new Error(
      `Intercambio de token fallo (${response.status}): ${data.error ?? "unknown"} - ${data.error_description ?? text}`
    );
  }

  return data;
}

function createResourceDpopProof(dpopKeys, accessToken, url) {
  return createDpopProof({
    privateKey: dpopKeys.privateKey,
    publicJwk: dpopKeys.publicJwk,
    method: "GET",
    url,
    accessToken,
  });
}

function printResourceServerRequest(accessToken, dpopProof, url) {
  console.log("");
  console.log("=== DPoP proof para Resource Server ===");
  console.log(`resource_url:   ${url}`);
  console.log(`dpop_proof:     ${dpopProof}`);
  console.log("");
  console.log("=== curl GET /cities ===");
  console.log(`curl -s ${url} \\`);
  console.log(`  -H "Authorization: DPoP ${accessToken}" \\`);
  console.log(`  -H "DPoP: ${dpopProof}" \\`);
  console.log(`  -H "Accept: application/json"`);
  console.log("");
  console.log("(El proof expira en ~5 min; genera uno nuevo por request si falla.)");
}

async function callProtectedResource(config, { accessToken, dpopKeys, url }) {
  const dpopProof = createResourceDpopProof(dpopKeys, accessToken, url);

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `DPoP ${accessToken}`,
      DPoP: dpopProof,
    },
  });

  const text = await response.text();
  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!response.ok) {
    throw new Error(
      `Resource Server respondio error (${response.status}): ${typeof data === "string" ? data : JSON.stringify(data)}`
    );
  }

  return data;
}

function waitForAuthorizationCode(config, expectedState) {
  return new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", `http://${config.callbackHost}:${config.callbackPort}`);

        if (requestUrl.pathname !== new URL(config.redirectUri).pathname) {
          res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
          res.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        if (error) {
          const description = requestUrl.searchParams.get("error_description") ?? "";
          throw new Error(`${error}${description ? `: ${description}` : ""}`);
        }

        const code = requestUrl.searchParams.get("code");
        const state = requestUrl.searchParams.get("state");

        if (!code) {
          throw new Error("El callback no incluyo authorization code");
        }

        if (state !== expectedState) {
          throw new Error("State invalido: posible ataque CSRF o sesion mezclada");
        }

        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(`<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><title>TPP Demo</title></head>
  <body style="font-family: sans-serif; max-width: 640px; margin: 3rem auto;">
    <h1>Autorizacion completada</h1>
    <p>Puedes cerrar esta ventana y volver a la terminal.</p>
  </body>
</html>`);

        server.close(() => resolve(code));
      } catch (callbackError) {
        res.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" });
        res.end(`Error: ${callbackError.message}`);
        server.close(() => reject(callbackError));
      }
    });

    server.on("error", reject);

    server.listen(config.callbackPort, config.callbackHost, () => {
      console.log(`Callback escuchando en ${config.redirectUri}`);
    });
  });
}

async function openBrowser(url) {
  if (process.platform === "darwin") {
    await execFileAsync("open", [url]);
    return;
  }

  if (process.platform === "win32") {
    await execFileAsync("cmd", ["/c", "start", "", url]);
    return;
  }

  await execFileAsync("xdg-open", [url]);
}

async function main() {
  const config = loadConfig();
  const { codeVerifier, codeChallenge } = createPkcePair();
  const state = createState();
  const dpopKeys = createDpopKeyPair();
  const totalSteps = config.resourceServerUrl ? 5 : 4;

  console.log("=== Cliente TPP (Authorization Code + PAR + PKCE + DPoP) ===");
  console.log(`Realm:      ${config.realm}`);
  console.log(`Client:     ${config.clientId}`);
  console.log(`Redirect:   ${config.redirectUri}`);
  console.log(`Scope:      ${config.scope}`);
  console.log(`DPoP jkt:   ${dpopKeys.dpopJkt}`);
  console.log("");

  console.log(`1/${totalSteps} Enviando Pushed Authorization Request (PAR + dpop_jkt)...`);
  const parResponse = await pushAuthorizationRequest(config, {
    codeChallenge,
    state,
    dpopJkt: dpopKeys.dpopJkt,
  });
  console.log(`    request_uri recibido (expira en ${parResponse.expires_in}s)`);

  const authorizeUrl = buildAuthorizeUrl(config, parResponse.request_uri);

  console.log(`2/${totalSteps} Esperando callback OAuth...`);
  const callbackPromise = waitForAuthorizationCode(config, state);

  console.log(`3/${totalSteps} Abriendo navegador para login/consentimiento...`);
  console.log(`    ${authorizeUrl}`);
  await openBrowser(authorizeUrl);

  const code = await callbackPromise;
  console.log("    Authorization code recibido");

  console.log(`4/${totalSteps} Intercambiando code por tokens (header DPoP)...`);
  const tokens = await exchangeCodeForTokens(config, { code, codeVerifier, dpopKeys });

  console.log("");
  console.log("=== Tokens obtenidos ===");
  console.log(`token_type:     ${tokens.token_type}`);
  console.log(`expires_in:     ${tokens.expires_in}s`);
  console.log(`scope:          ${tokens.scope ?? "(no reportado)"}`);
  //console.log(`access_token:   ${tokens.access_token?.slice(0, 48)}...`);
  console.log(`access_token:   ${tokens.access_token}`);

  if (tokens.refresh_token) {
    //console.log(`refresh_token:  ${tokens.refresh_token.slice(0, 48)}...`);
    console.log(`refresh_token:  ${tokens.refresh_token}`);
  }

  if (tokens.access_token) {
    const payload = decodeJwtPayload(tokens.access_token);
    console.log("");
    console.log("=== Payload JWT (sin verificar firma) ===");
    console.log(JSON.stringify(payload, null, 2));

    const resourceUrl =
      config.resourceServerUrl || "http://localhost:9090/cities";
    const resourceProof = createResourceDpopProof(
      dpopKeys,
      tokens.access_token,
      resourceUrl,
    );
    printResourceServerRequest(tokens.access_token, resourceProof, resourceUrl);

    if (config.resourceServerUrl) {
      console.log("");
      console.log(`5/${totalSteps} Llamando Resource Server con Authorization: DPoP...`);
      console.log(`    GET ${config.resourceServerUrl}`);
      const resourceData = await callProtectedResource(config, {
        accessToken: tokens.access_token,
        dpopKeys,
        url: config.resourceServerUrl,
      });
      console.log("");
      console.log("=== Respuesta Resource Server ===");
      console.log(JSON.stringify(resourceData, null, 2));
    }
  }

  console.log("");
  console.log("Flujo completado.");
}

main().catch((error) => {
  console.error("");
  console.error(`Error: ${error.message}`);
  process.exit(1);
});

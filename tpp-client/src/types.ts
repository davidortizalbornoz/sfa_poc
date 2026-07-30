import type { KeyObject } from "node:crypto";

export interface OidcEndpoints {
  par: string;
  authorize: string;
  token: string;
  discovery: string;
}

export interface AppConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
  callbackHost: string;
  callbackPort: number;
  resourceServerUrl: string;
  endpoints: OidcEndpoints;
}

export interface M2mConfig {
  baseUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  scope: string;
  resourceServerUrl: string;
  tokenEndpoint: string;
}

export interface DpopPublicJwk {
  kty: string;
  crv: string;
  x: string;
  y: string;
}

export interface DpopKeyPair {
  privateKey: KeyObject;
  publicJwk: DpopPublicJwk;
  dpopJkt: string;
}

export interface CreateDpopProofOptions {
  privateKey: KeyObject;
  publicJwk: DpopPublicJwk;
  method: string;
  url: string;
  accessToken?: string;
  nonce?: string;
}

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

export interface ParResponse {
  request_uri: string;
  expires_in: number;
}

export interface OAuthErrorBody {
  error?: string;
  error_description?: string;
}

export interface TokenResponse extends OAuthErrorBody {
  access_token?: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
}

export interface JwtPayload {
  cnf?: {
    jkt?: string;
  };
  [key: string]: unknown;
}

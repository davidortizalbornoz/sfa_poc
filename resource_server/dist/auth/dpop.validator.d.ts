import { type JsonWebKey } from 'node:crypto';
export declare function computeJwkThumbprint(jwk: JsonWebKey): string;
export declare function buildRequestTargetUri(request: {
    protocol: string;
    originalUrl: string;
    get(name: string): string | undefined;
}): string;
export declare function validateDpopProof(options: {
    proof: string;
    method: string;
    url: string;
    accessToken: string;
    expectedJkt: string;
}): void;

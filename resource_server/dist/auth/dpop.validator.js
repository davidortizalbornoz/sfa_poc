"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeJwkThumbprint = computeJwkThumbprint;
exports.buildRequestTargetUri = buildRequestTargetUri;
exports.validateDpopProof = validateDpopProof;
const common_1 = require("@nestjs/common");
const node_crypto_1 = require("node:crypto");
const ALLOWED_ALGORITHMS = new Set(['ES256', 'RS256', 'PS256']);
const MAX_PROOF_AGE_SECONDS = 300;
const MAX_CLOCK_SKEW_SECONDS = 60;
function decodeBase64Url(value) {
    const padded = value + '='.repeat((4 - (value.length % 4)) % 4);
    return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}
function parseDpopProof(proof) {
    const parts = proof.split('.');
    if (parts.length !== 3) {
        throw new common_1.UnauthorizedException('Invalid DPoP proof format');
    }
    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    try {
        const header = JSON.parse(decodeBase64Url(encodedHeader).toString('utf8'));
        const payload = JSON.parse(decodeBase64Url(encodedPayload).toString('utf8'));
        return {
            header,
            payload,
            signingInput: `${encodedHeader}.${encodedPayload}`,
            signature: decodeBase64Url(encodedSignature),
        };
    }
    catch {
        throw new common_1.UnauthorizedException('Invalid DPoP proof encoding');
    }
}
function computeJwkThumbprint(jwk) {
    let canonical;
    if (jwk.kty === 'EC') {
        canonical = JSON.stringify({
            crv: jwk.crv,
            kty: jwk.kty,
            x: jwk.x,
            y: jwk.y,
        });
    }
    else if (jwk.kty === 'RSA') {
        canonical = JSON.stringify({
            e: jwk.e,
            kty: jwk.kty,
            n: jwk.n,
        });
    }
    else {
        throw new common_1.UnauthorizedException('Unsupported DPoP proof key type');
    }
    return (0, node_crypto_1.createHash)('sha256').update(canonical).digest('base64url');
}
function verifyProofSignature(header, signingInput, signature) {
    if (header.typ !== 'dpop+jwt') {
        throw new common_1.UnauthorizedException('Invalid DPoP proof typ');
    }
    const alg = header.alg;
    if (!alg || !ALLOWED_ALGORITHMS.has(alg)) {
        throw new common_1.UnauthorizedException(`Unsupported DPoP proof algorithm: ${alg ?? 'missing'}`);
    }
    if (!header.jwk) {
        throw new common_1.UnauthorizedException('DPoP proof missing jwk header');
    }
    const publicKey = (0, node_crypto_1.createPublicKey)({ key: header.jwk, format: 'jwk' });
    const verified = alg === 'ES256'
        ? (0, node_crypto_1.verify)('sha256', Buffer.from(signingInput), { key: publicKey, dsaEncoding: 'ieee-p1363' }, signature)
        : (0, node_crypto_1.verify)('sha256', Buffer.from(signingInput), publicKey, signature);
    if (!verified) {
        throw new common_1.UnauthorizedException('Invalid DPoP proof signature');
    }
}
function normalizeHtu(value) {
    const url = new URL(value);
    url.search = '';
    url.hash = '';
    return url.toString();
}
function buildRequestTargetUri(request) {
    const host = request.get('host');
    if (!host) {
        throw new common_1.UnauthorizedException('Cannot determine request host for DPoP validation');
    }
    const path = request.originalUrl.split('?')[0].split('#')[0];
    return normalizeHtu(`${request.protocol}://${host}${path}`);
}
function validateDpopProof(options) {
    const { header, payload, signingInput, signature } = parseDpopProof(options.proof);
    verifyProofSignature(header, signingInput, signature);
    const proofJkt = computeJwkThumbprint(header.jwk);
    if (proofJkt !== options.expectedJkt) {
        throw new common_1.UnauthorizedException('DPoP proof key does not match token cnf.jkt');
    }
    if (payload.htm?.toUpperCase() !== options.method.toUpperCase()) {
        throw new common_1.UnauthorizedException('DPoP proof htm mismatch');
    }
    if (normalizeHtu(payload.htu ?? '') !== normalizeHtu(options.url)) {
        throw new common_1.UnauthorizedException('DPoP proof htu mismatch');
    }
    if (typeof payload.iat !== 'number') {
        throw new common_1.UnauthorizedException('DPoP proof missing iat');
    }
    const now = Math.floor(Date.now() / 1000);
    if (payload.iat > now + MAX_CLOCK_SKEW_SECONDS) {
        throw new common_1.UnauthorizedException('DPoP proof iat is in the future');
    }
    if (now - payload.iat > MAX_PROOF_AGE_SECONDS) {
        throw new common_1.UnauthorizedException('DPoP proof expired');
    }
    if (!payload.jti) {
        throw new common_1.UnauthorizedException('DPoP proof missing jti');
    }
    const expectedAth = (0, node_crypto_1.createHash)('sha256')
        .update(options.accessToken)
        .digest('base64url');
    if (payload.ath !== expectedAth) {
        throw new common_1.UnauthorizedException('DPoP proof ath mismatch');
    }
}
//# sourceMappingURL=dpop.validator.js.map
"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var JwtStrategy_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtStrategy = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const passport_1 = require("@nestjs/passport");
const node_crypto_1 = require("node:crypto");
const jwks_rsa_1 = require("jwks-rsa");
const passport_jwt_1 = require("passport-jwt");
const dpop_validator_1 = require("./dpop.validator");
let JwtStrategy = JwtStrategy_1 = class JwtStrategy extends (0, passport_1.PassportStrategy)(passport_jwt_1.Strategy) {
    configService;
    logger = new common_1.Logger(JwtStrategy_1.name);
    publicKeysLogged = false;
    logPublicKeysPromise = null;
    constructor(configService) {
        const jwksUri = configService.getOrThrow('KEYCLOAK_JWKS_URI');
        const jwksProvider = (0, jwks_rsa_1.passportJwtSecret)({
            cache: true,
            rateLimit: true,
            jwksRequestsPerMinute: 10,
            jwksUri,
        });
        const strategyHolder = {};
        super({
            jwtFromRequest: passport_jwt_1.ExtractJwt.fromAuthHeaderWithScheme('DPoP'),
            passReqToCallback: true,
            ignoreExpiration: false,
            issuer: configService.getOrThrow('KEYCLOAK_ISSUER'),
            algorithms: ['RS256'],
            audience: configService.get('KEYCLOAK_AUDIENCE'),
            secretOrKeyProvider: (request, rawJwtToken, done) => {
                void strategyHolder.current
                    ?.ensurePublicKeysLogged()
                    .then(() => jwksProvider(request, rawJwtToken, done))
                    .catch((error) => {
                    done(error instanceof Error ? error : new Error(String(error)));
                });
            },
        });
        this.configService = configService;
        strategyHolder.current = this;
    }
    async onModuleInit() {
        await this.ensurePublicKeysLogged();
    }
    ensurePublicKeysLogged() {
        if (!this.logPublicKeysPromise) {
            this.logPublicKeysPromise = this.logPublicKeysFromJwks();
        }
        return this.logPublicKeysPromise;
    }
    async logPublicKeysFromJwks() {
        if (this.publicKeysLogged) {
            return;
        }
        const jwksUri = this.configService.getOrThrow('KEYCLOAK_JWKS_URI');
        const response = await fetch(jwksUri);
        if (!response.ok) {
            throw new Error(`No se pudo obtener JWKS (${response.status}): ${jwksUri}`);
        }
        const jwks = (await response.json());
        const signingKeys = jwks.keys.filter((key) => key.kty === 'RSA' && (key.use === 'sig' || key.use === undefined));
        if (signingKeys.length === 0) {
            throw new Error(`JWKS sin claves RSA de firma: ${jwksUri}`);
        }
        this.logger.log(`Claves publicas Keycloak (PEM) desde ${jwksUri} — antes de validar tokens:`);
        for (const jwk of signingKeys) {
            const pem = (0, node_crypto_1.createPublicKey)({ key: jwk, format: 'jwk' }).export({
                type: 'spki',
                format: 'pem',
            });
            const pemText = typeof pem === 'string' ? pem : pem.toString('utf8');
            const keyId = typeof jwk.kid === 'string' || typeof jwk.kid === 'number'
                ? String(jwk.kid)
                : 'unknown';
            console.log(`\n----- Keycloak signing key (kid: ${keyId}) -----\n${pemText}`);
        }
        this.publicKeysLogged = true;
    }
    validate(request, payload) {
        const accessToken = passport_jwt_1.ExtractJwt.fromAuthHeaderWithScheme('DPoP')(request);
        if (!accessToken) {
            throw new common_1.UnauthorizedException('Missing DPoP access token');
        }
        const dpopProof = request.headers.dpop;
        if (typeof dpopProof !== 'string') {
            throw new common_1.UnauthorizedException('Missing DPoP proof header');
        }
        const expectedJkt = payload.cnf?.jkt;
        if (!expectedJkt) {
            throw new common_1.UnauthorizedException('Access token is not DPoP-bound (missing cnf.jkt)');
        }
        (0, dpop_validator_1.validateDpopProof)({
            proof: dpopProof,
            method: request.method,
            url: (0, dpop_validator_1.buildRequestTargetUri)(request),
            accessToken,
            expectedJkt,
        });
        const requiredScope = this.configService.get('REQUIRED_SCOPE');
        if (requiredScope) {
            const scopes = payload.scope?.split(' ') ?? [];
            if (!scopes.includes(requiredScope)) {
                throw new common_1.UnauthorizedException(`Missing required scope: ${requiredScope}`);
            }
        }
        return {
            sub: payload.sub,
            scope: payload.scope,
            azp: payload.azp,
            preferredUsername: payload.preferred_username,
            email: payload.email,
        };
    }
};
exports.JwtStrategy = JwtStrategy;
exports.JwtStrategy = JwtStrategy = JwtStrategy_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwtStrategy);
//# sourceMappingURL=jwt.strategy.js.map
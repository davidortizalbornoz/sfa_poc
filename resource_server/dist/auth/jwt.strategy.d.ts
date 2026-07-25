import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { AuthenticatedUser } from './authenticated-user.interface';
interface KeycloakAccessTokenPayload {
    sub: string;
    scope?: string;
    azp?: string;
    preferred_username?: string;
    email?: string;
    aud?: string | string[];
    cnf?: {
        jkt?: string;
    };
}
declare const JwtStrategy_base: new (...args: [opt: import("passport-jwt").StrategyOptionsWithRequest] | [opt: import("passport-jwt").StrategyOptionsWithoutRequest]) => Strategy & {
    validate(...args: any[]): unknown;
};
export declare class JwtStrategy extends JwtStrategy_base implements OnModuleInit {
    private readonly configService;
    private readonly logger;
    private publicKeysLogged;
    private logPublicKeysPromise;
    constructor(configService: ConfigService);
    onModuleInit(): Promise<void>;
    private ensurePublicKeysLogged;
    private logPublicKeysFromJwks;
    validate(request: Request, payload: KeycloakAccessTokenPayload): AuthenticatedUser;
}
export {};

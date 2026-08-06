package cl.bci.sfa.clientregistration;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.keycloak.component.ComponentModel;
import org.keycloak.representations.idm.ClientRepresentation;

class ClientJwksResolverTest {

  private ComponentModel config;
  private SfaSoftwareStatementClaims claims;

  @BeforeEach
  void setUp() {
    config = new ComponentModel();
    claims =
        new SfaSoftwareStatementClaims(
            "https://directorio-qa.finanzasabiertas.cl",
            1L,
            "SW-TPP-DEMO-001",
            "ORG-TPP-001",
            "https://tpp-demo.localtest.me/.well-known/jwks.json",
            java.util.List.of("http://localhost:3000/callback"),
            "TPP Demo SFA POC",
            null,
            "1.0.0");
  }

  @Test
  void embedsJwksFromBaseDirConvention() throws Exception {
    Path baseDir = Path.of("test-keys/client-jwks").toAbsolutePath();
    config
        .getConfig()
        .putSingle(
            SfaSoftwareStatementClientRegistrationPolicyFactory.CONFIG_POC_CLIENT_JWKS_BASE_DIR,
            baseDir.toUri().toString());

    String embedded = ClientJwksResolver.resolveEmbeddedJwks(config, claims);

    assertNotNull(embedded);
    assertTrue(embedded.contains("tpp-demo-client-1"));
  }

  @Test
  void embedsJwksFromExplicitUriMapping() throws Exception {
    Path jwksPath =
        Path.of("test-keys/client-jwks/SW-TPP-DEMO-001/jwks.json").toAbsolutePath();
    config
        .getConfig()
        .add(
            SfaSoftwareStatementClientRegistrationPolicyFactory.CONFIG_POC_CLIENT_JWKS_URI_MAPPINGS,
            claims.getSoftwareJwksUri() + "=" + jwksPath.toUri());

    String embedded = ClientJwksResolver.resolveEmbeddedJwks(config, claims);

    assertNotNull(embedded);
    assertTrue(embedded.contains("tpp-demo-client-1"));
  }

  @Test
  void returnsNullWhenNoLocalJwksConfigured() throws Exception {
    assertNull(ClientJwksResolver.resolveEmbeddedJwks(config, claims));
  }

  @Test
  void applyClaimsToClientUsesEmbeddedJwksWhenAvailable() throws Exception {
    Path baseDir = Path.of("test-keys/client-jwks").toAbsolutePath();
    config
        .getConfig()
        .putSingle(
            SfaSoftwareStatementClientRegistrationPolicyFactory.CONFIG_POC_CLIENT_JWKS_BASE_DIR,
            baseDir.toUri().toString());

    ClientRepresentation client = new ClientRepresentation();
    SfaSoftwareStatementValidator.applyClaimsToClient(client, claims, config);

    assertEquals("false", client.getAttributes().get("use.jwks.url"));
    assertEquals("true", client.getAttributes().get("use.jwks.string"));
    assertNotNull(client.getAttributes().get("jwks.string"));
    assertEquals(
        claims.getSoftwareJwksUri(), client.getAttributes().get("jwks.url"));
    assertEquals(
        claims.getSoftwareJwksUri(), client.getAttributes().get("sfa.software_jwks_uri"));
  }

  @Test
  void applyClaimsToClientUsesRemoteJwksUrlWhenLocalFileMissing() throws Exception {
    SfaSoftwareStatementClaims unknownClient =
        new SfaSoftwareStatementClaims(
            claims.getIssuer(),
            claims.getIssuedAt(),
            "UNKNOWN-CLIENT",
            claims.getOrganisationId(),
            "https://unknown.localtest.me/.well-known/jwks.json",
            claims.getRedirectUris(),
            claims.getSoftwareClientName(),
            claims.getSoftwareClientUri(),
            claims.getSoftwareVersion());

    Path baseDir = Path.of("test-keys/client-jwks").toAbsolutePath();
    config
        .getConfig()
        .putSingle(
            SfaSoftwareStatementClientRegistrationPolicyFactory.CONFIG_POC_CLIENT_JWKS_BASE_DIR,
            baseDir.toUri().toString());

    ClientRepresentation client = new ClientRepresentation();
    SfaSoftwareStatementValidator.applyClaimsToClient(client, unknownClient, config);

    assertEquals("true", client.getAttributes().get("use.jwks.url"));
    assertEquals("false", client.getAttributes().get("use.jwks.string"));
    assertNull(client.getAttributes().get("jwks.string"));
    assertEquals(
        unknownClient.getSoftwareJwksUri(), client.getAttributes().get("jwks.url"));
  }
}

package cl.bci.sfa.clientregistration;

import org.keycloak.jose.jwk.JSONWebKeySet;
import org.keycloak.services.clientregistration.ClientRegistrationContext;
import org.keycloak.services.clientregistration.oidc.OIDCClientRegistrationContext;

/** Acceso reflexivo a metadatos OIDC DCR no expuestos en {@code ClientRegistrationContext}. */
final class OidcContextReader {

  private OidcContextReader() {}

  static String getJwksUri(ClientRegistrationContext context) {
    return readString(context, "getJwksUri");
  }

  static JSONWebKeySet getJwks(ClientRegistrationContext context) {
    Object value = read(context, "getJwks");
    if (value instanceof JSONWebKeySet jwks) {
      return jwks;
    }
    return null;
  }

  private static String readString(ClientRegistrationContext context, String methodName) {
    Object value = read(context, methodName);
    return value instanceof String str ? str : null;
  }

  private static Object read(ClientRegistrationContext context, String methodName) {
    if (!(context instanceof OIDCClientRegistrationContext oidcContext)) {
      return null;
    }

    try {
      var field = OIDCClientRegistrationContext.class.getDeclaredField("oidcRep");
      field.setAccessible(true);
      Object oidcRep = field.get(oidcContext);
      if (oidcRep == null) {
        return null;
      }
      var method = oidcRep.getClass().getMethod(methodName);
      return method.invoke(oidcRep);
    } catch (ReflectiveOperationException ex) {
      return null;
    }
  }
}

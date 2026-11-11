-- 0008 revoked EXECUTE on future functions with ALTER DEFAULT PRIVILEGES ... IN SCHEMA
-- public, but a per-schema default can only add to the global defaults, never take away
-- from them. The global default lets PUBLIC (every role, anon and authenticated included)
-- execute every new function, so functions created after 0008 were still executable
-- through the Data API. Revoke it globally for the role that runs migrations: functions
-- postgres creates from now on, in any schema, are executable only by roles granted
-- EXECUTE explicitly. Triggers don't need EXECUTE to fire, so trigger functions still work.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

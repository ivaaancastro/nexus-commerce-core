# syntax=docker/dockerfile:1
# Backend de Nexus Commerce Core — imagen de producción (Fase 10, R4).
# Multi-etapa: JDK 21 para compilar, JRE 21 para ejecutar. Portable entre
# proveedores (Render, Fly.io, Koyeb): toda la configuración llega por entorno.
#
#   docker build -t nexus-backend backend/
#   docker run -p 8080:8080 -e SPRING_PROFILES_ACTIVE=prod,demo -e DATABASE_URL=… nexus-backend

# ── 1) Compilación ──────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jdk AS build
WORKDIR /app

# Dependencias primero: se cachean mientras el pom no cambie.
COPY mvnw pom.xml ./
COPY .mvn .mvn
RUN chmod +x mvnw && ./mvnw -q -B dependency:go-offline

COPY src src
# Los tests corren en CI contra PostgreSQL; aquí solo se empaqueta.
RUN ./mvnw -q -B package -DskipTests && cp target/backend-*.jar /app/app.jar

# ── 2) Ejecución ────────────────────────────────────────────────────────────
FROM eclipse-temurin:21-jre
WORKDIR /app

# curl solo para el HEALTHCHECK; usuario sin privilegios.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 --no-create-home nexus

COPY --from=build --chown=nexus:nexus /app/app.jar app.jar
USER nexus

# Acotado para 512 MB (plan gratuito de Render), MEDIDO con `docker run --memory=512m`
# y carga (spec fase10, D.1): con -Xmx300m el proceso llegaba a ~454 MiB y con NMT
# activo moría por OOM; NMT mostró la heap comprometida (259 MB) como mayor partida.
# Con -Xmx200m + MALLOC_ARENA_MAX=2: ~385 MiB bajo carga, sin OutOfMemoryError.
# SerialGC: el de menor huella con 1 vCPU.
ENV JAVA_OPTS="-Xmx200m -Xss512k -XX:MaxMetaspaceSize=128m -XX:ReservedCodeCacheSize=48m -XX:+UseSerialGC -XX:TieredStopAtLevel=1" \
    MALLOC_ARENA_MAX=2 \
    SPRING_PROFILES_ACTIVE=prod \
    PORT=8080

EXPOSE 8080

# /api/v1/health es solo ADMIN (Fase 8): /api/v1/markets es público y no
# responde hasta que Flyway ha migrado (mismo readiness que los E2E).
HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD curl -fsS "http://localhost:${PORT}/api/v1/markets" > /dev/null || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]

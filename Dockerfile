# =========================================================
# Stage 1: Build - Maven + JDK 21 (Alpine-basiert)
# =========================================================
FROM eclipse-temurin:21-jdk-alpine AS build

WORKDIR /app

# Erst nur die Maven-Wrapper-Dateien + pom.xml kopieren,
# damit Docker das Dependency-Layer cachen kann
COPY mvnw .
COPY .mvn .mvn
COPY pom.xml .
RUN chmod +x mvnw && ./mvnw dependency:go-offline -B

# Jetzt den Quellcode kopieren und bauen
COPY src ./src
RUN ./mvnw clean package -DskipTests -B

# =========================================================
# Stage 2: Runtime - nur JRE (Alpine, schlank)
# =========================================================
FROM eclipse-temurin:21-jre-alpine AS runtime

# curl wird fuer den Healthcheck benoetigt (Alpine hat es nicht vorinstalliert)
RUN apk add --no-cache curl

# Eigener, nicht-root User für den Container
RUN addgroup -S spring && adduser -S spring -G spring

WORKDIR /app

COPY --from=build /app/target/planning-poker-0.0.1-SNAPSHOT.jar app.jar

# Datenverzeichnis (z.B. falls H2-Fallback genutzt wird) anlegen und Rechte setzen
RUN mkdir -p /app/data && chown -R spring:spring /app

USER spring

EXPOSE 8080

# Context-Path muss im Healthcheck mitberuecksichtigt werden
# (z.B. APP_CONTEXT_PATH=/planning-poker hinter dem Reverse Proxy)
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD curl -f "http://localhost:8080${APP_CONTEXT_PATH}/actuator/health" || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]

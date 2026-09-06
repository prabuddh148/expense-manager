# ---- build ----------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

# Copy the wrapper first so dependency resolution is cached separately from source.
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
# Best-effort dependency warm-up: if it cannot resolve everything offline the
# package step below downloads the rest, so a miss must not fail the build.
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline || true

COPY src/ src/
# Tests run in CI, not in the image build - keeps free-tier build minutes down.
RUN ./mvnw -B -q clean package -DskipTests

# ---- run ------------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app

# Never run the API as root.
RUN useradd --system --uid 1001 --create-home appuser
USER appuser

COPY --from=build --chown=appuser:appuser /app/target/*.jar app.jar

ENV SPRING_PROFILES_ACTIVE=prod
# Free tiers are memory-capped; let the JVM size itself against the real cgroup limit.
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"

EXPOSE 8080
CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

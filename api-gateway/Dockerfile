# ---- build ----------------------------------------------------------------
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app

COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline || true

COPY src/ src/
RUN ./mvnw -B -q clean package -DskipTests

# ---- run ------------------------------------------------------------------
FROM eclipse-temurin:25-jre
WORKDIR /app

RUN useradd --system --uid 1001 --create-home appuser
USER appuser

COPY --from=build --chown=appuser:appuser /app/target/*.jar app.jar

ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC"

EXPOSE 8000
CMD ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]

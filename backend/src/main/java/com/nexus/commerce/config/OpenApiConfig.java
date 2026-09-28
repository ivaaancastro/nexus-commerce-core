package com.nexus.commerce.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI customOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Nexus Commerce Core API")
                        .version("1.0.0")
                        .description("Plataforma transaccional de retail global con catálogo jerárquico, "
                                + "precios multimercado, reservas de inventario concurrentes, "
                                + "búsqueda vectorial HNSW (pgvector) y checkout transaccional idempotente.")
                        .contact(new Contact()
                                .name("Nexus Core Engineering Team")
                                .email("engineering@nexus-commerce.internal"))
                        .license(new License()
                                .name("Apache 2.0")
                                .url("https://www.apache.org/licenses/LICENSE-2.0")))
                .servers(List.of(
                        new Server()
                                .url("http://localhost:8080")
                                .description("Entorno Local de Desarrollo")
                ));
    }
}
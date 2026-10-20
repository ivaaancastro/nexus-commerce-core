import "@testing-library/jest-dom/vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import AdminUsersPage from "@/app/admin/users/page";
import { api } from "@/lib/api";
import type { AdminUser, AdminUserPage } from "@/types/auth";

/**
 * Tarea 7.5 (spec specs/admin-users/, R6) — el listado de `/admin/users`.
 *
 * Cubre: tabla y cabeceras con acciones condicionales por rol/estado, búsqueda
 * que consulta la API (nunca `filter()` en cliente), suspender con confirm →
 * toast + fila actualizada sin re-fetch, restaurar sin confirmación, cambio de
 * rol con confirm al quitar, `409 USER_CONFLICT` bajo la fila sin toast y los
 * estados vacío/cargando. `getAdminUsers` se mockea como `Promise` resuelta
 * ANTES de renderizar (patrón del proyecto).
 */

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
    usePathname: () => "/admin/users",
}));

vi.mock("@/lib/api", () => ({
    api: {
        getAdminUsers: vi.fn(),
        updateAdminUserRole: vi.fn(),
        setAdminUserSuspension: vi.fn(),
    },
}));

function usuario(extras: Partial<AdminUser> = {}): AdminUser {
    return {
        id: 1,
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "García",
        role: "USER",
        suspended: false,
        suspendedAt: null,
        createdAt: "2026-10-01T09:00:00Z",
        ...extras,
    };
}

function pagina(users: AdminUser[], extras: Partial<AdminUserPage> = {}): AdminUserPage {
    return {
        users,
        page: 0,
        size: 20,
        totalElements: users.length,
        totalPages: 1,
        ...extras,
    };
}

describe("AdminUsersPage", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Promesa resuelta ANTES de renderizar (patrón del proyecto)
        vi.mocked(api.getAdminUsers).mockResolvedValue(pagina([usuario()]));
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("carga la página: cabeceras, estados, rol y acciones condicionales (R6)", async () => {
        vi.mocked(api.getAdminUsers).mockResolvedValue(
            pagina([
                usuario(),
                usuario({
                    id: 2,
                    email: "admin@nexus.dev",
                    firstName: "Admin",
                    lastName: "Nexus",
                    role: "ADMIN",
                }),
                usuario({
                    id: 3,
                    email: "lola@example.com",
                    role: "USER",
                    suspended: true,
                    suspendedAt: "2026-10-10T10:00:00Z",
                }),
            ])
        );

        render(<AdminUsersPage />);

        expect(await screen.findByText("Gestión de usuarios")).toBeInTheDocument();

        const tabla = screen.getByRole("table");
        for (const cabecera of ["Email", "Nombre", "Rol", "Estado", "Alta", "Acciones"]) {
            expect(
                within(tabla).getByRole("columnheader", { name: cabecera })
            ).toBeInTheDocument();
        }

        expect(within(tabla).getByText("ana@example.com")).toBeInTheDocument();
        expect(within(tabla).getByText("Administrador")).toBeInTheDocument();
        // Dos activas y una suspendida con su fecha (Estado, R6)
        expect(within(tabla).getAllByText("Activo")).toHaveLength(2);
        expect(within(tabla).getByText(/Suspendido desde/)).toBeInTheDocument();

        // Acciones condicionales al rol/estado, sin selects ni modales
        expect(within(tabla).getAllByRole("button", { name: "Suspender" })).toHaveLength(2);
        expect(within(tabla).getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
        expect(
            within(tabla).getAllByRole("button", { name: "Hacer administrador" })
        ).toHaveLength(2);
        expect(
            within(tabla).getByRole("button", { name: "Quitar administrador" })
        ).toBeInTheDocument();

        expect(api.getAdminUsers).toHaveBeenCalledWith({ page: 0, q: undefined });
    });

    it("la búsqueda manda q recortado al servidor (R6: nunca filter() en cliente)", async () => {
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        await usuarioEvento.type(screen.getByLabelText("Buscar usuario"), "  ana  ");
        await usuarioEvento.click(screen.getByRole("button", { name: "Buscar" }));

        expect(api.getAdminUsers).toHaveBeenLastCalledWith({ page: 0, q: "ana" });
    });

    it("suspender: exige confirm, llama a la API, toast y fila actualizada sin re-fetch", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(api.setAdminUserSuspension).mockResolvedValue(
            usuario({ suspended: true, suspendedAt: "2026-10-19T10:00:00Z" })
        );
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        await usuarioEvento.click(screen.getByRole("button", { name: "Suspender" }));

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(api.setAdminUserSuspension).toHaveBeenCalledWith(1, { suspended: true });

        // Toast + fila pintada con la respuesta del PUT, sin volver a pedir la página
        expect(await screen.findByText("Cuenta suspendida")).toBeInTheDocument();
        expect(screen.getByText(/Suspendido desde/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
        expect(api.getAdminUsers).toHaveBeenCalledTimes(1);
    });

    it("suspender cancelando el confirm no toca la API", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        await usuarioEvento.click(screen.getByRole("button", { name: "Suspender" }));

        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(api.setAdminUserSuspension).not.toHaveBeenCalled();
    });

    it("restaurar no pide confirmación y devuelve la fila a Activo con toast", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(api.getAdminUsers).mockResolvedValue(
            pagina([usuario({ suspended: true, suspendedAt: "2026-10-10T10:00:00Z" })])
        );
        vi.mocked(api.setAdminUserSuspension).mockResolvedValue(usuario());
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        await usuarioEvento.click(screen.getByRole("button", { name: "Restaurar" }));

        expect(confirmSpy).not.toHaveBeenCalled();
        expect(api.setAdminUserSuspension).toHaveBeenCalledWith(1, { suspended: false });
        expect(await screen.findByText("Cuenta restaurada")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Suspender" })).toBeInTheDocument();
    });

    it("cambiar rol: promover sin confirm, quitar con confirm (toast y fila sin re-fetch)", async () => {
        const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(api.updateAdminUserRole)
            .mockResolvedValueOnce(usuario({ role: "ADMIN" }))
            .mockResolvedValueOnce(usuario({ role: "USER" }));
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        // Promover: sin confirmación
        await usuarioEvento.click(
            screen.getByRole("button", { name: "Hacer administrador" })
        );
        expect(confirmSpy).not.toHaveBeenCalled();
        expect(api.updateAdminUserRole).toHaveBeenLastCalledWith(1, { role: "ADMIN" });
        expect(await screen.findByText("Rol actualizado")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Quitar administrador" })
        ).toBeInTheDocument();

        // Quitar: con confirmación
        await usuarioEvento.click(
            screen.getByRole("button", { name: "Quitar administrador" })
        );
        expect(confirmSpy).toHaveBeenCalledTimes(1);
        expect(api.updateAdminUserRole).toHaveBeenLastCalledWith(1, { role: "USER" });
        expect(
            await screen.findByRole("button", { name: "Hacer administrador" })
        ).toBeInTheDocument();
    });

    it("409 USER_CONFLICT: mensaje bajo la fila, sin toast y con la fila intacta (E.3)", async () => {
        vi.spyOn(window, "confirm").mockReturnValue(true);
        vi.mocked(api.setAdminUserSuspension).mockRejectedValue(
            new Error(
                'API Error [409]: {"code":"USER_CONFLICT","message":"No puedes suspenderte a ti mismo"}'
            )
        );
        const usuarioEvento = userEvent.setup();
        render(<AdminUsersPage />);
        await screen.findByText("Gestión de usuarios");

        await usuarioEvento.click(screen.getByRole("button", { name: "Suspender" }));

        const alerta = await screen.findByRole("alert");
        expect(alerta).toHaveTextContent("No puedes suspenderte a ti mismo");
        // Sin toast de éxito y con la fila sin modificar
        expect(screen.queryByText("Cuenta suspendida")).not.toBeInTheDocument();
        expect(screen.getByText("Activo")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Suspender" })).toBeInTheDocument();
    });

    it("estado vacío: editorial sin filtros y «Sin resultados» con búsqueda activa", async () => {
        const usuarioEvento = userEvent.setup();
        vi.mocked(api.getAdminUsers).mockResolvedValue(pagina([]));

        render(<AdminUsersPage />);
        expect(await screen.findByText(/Todavía no hay usuarios registrados/)).toBeInTheDocument();

        await usuarioEvento.type(screen.getByLabelText("Buscar usuario"), "ana");
        await usuarioEvento.click(screen.getByRole("button", { name: "Buscar" }));

        expect(await screen.findByText(/Sin resultados/)).toBeInTheDocument();
        expect(api.getAdminUsers).toHaveBeenLastCalledWith({ page: 0, q: "ana" });
    });

    it("estado de carga inicial mientras no llega la primera página", async () => {
        vi.mocked(api.getAdminUsers).mockReturnValue(
            new Promise<AdminUserPage>(() => {})
        );

        render(<AdminUsersPage />);

        expect(await screen.findByText("Cargando usuarios...")).toBeInTheDocument();
    });
});

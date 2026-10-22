import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import AdminProductForm from "@/components/AdminProductForm";
import { api } from "@/lib/api";
import type { Product } from "@/types/commerce";

vi.mock("@/lib/api", () => ({
    api: {
        createAdminProduct: vi.fn(),
        updateAdminProduct: vi.fn(),
    },
}));

const producto: Product = {
    id: 7,
    referenceCode: "7201/001",
    name: "Blazer Prueba 72",
    family: "OUTERWEAR",
    description: "Descripción inicial",
    skus: [],
};

/**
 * Tarea 7.2 (E.4/E.5) — formulario de producto del panel.
 *
 * Verifica la validación espejo en cliente (D8), el envío válido con su toast,
 * la traducción del 409 del backend y la inmutabilidad de la referencia en
 * modo edición (R2.4).
 */
describe("AdminProductForm", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("validación en cliente: no llama a la API e invita a corregir", async () => {
        const usuario = userEvent.setup();
        render(<AdminProductForm />);

        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        expect(api.createAdminProduct).not.toHaveBeenCalled();
        expect(screen.getByText("La referencia es obligatoria.")).toBeInTheDocument();
        expect(screen.getByText("El nombre es obligatorio.")).toBeInTheDocument();
        expect(screen.getByText("La familia es obligatoria.")).toBeInTheDocument();
    });

    it("rechaza una referencia mal formada y una familia en minúsculas", async () => {
        const usuario = userEvent.setup();
        render(<AdminProductForm />);

        await usuario.type(screen.getByLabelText("Referencia"), "ABC");
        await usuario.type(screen.getByLabelText("Nombre"), "Blazer");
        await usuario.type(screen.getByLabelText("Familia"), "outerwear");
        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        expect(screen.getByText("Formato NNNN/NNN (ej. 0432/021).")).toBeInTheDocument();
        expect(screen.getByText("En mayúsculas (ej. OUTERWEAR).")).toBeInTheDocument();
        expect(api.createAdminProduct).not.toHaveBeenCalled();
    });

    it("envío válido crea el producto y muestra el toast (E.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.createAdminProduct).mockResolvedValue({ ...producto, id: 99 });

        render(<AdminProductForm />);

        await usuario.type(screen.getByLabelText("Referencia"), "7201/005");
        await usuario.type(screen.getByLabelText("Nombre"), "Abrigo Lana");
        await usuario.type(screen.getByLabelText("Familia"), "OUTERWEAR");
        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        expect(await screen.findByText(/Producto 7201\/005 creado/)).toBeInTheDocument();
        expect(api.createAdminProduct).toHaveBeenCalledWith({
            referenceCode: "7201/005",
            name: "Abrigo Lana",
            family: "OUTERWEAR",
        });

        // El formulario queda listo para el siguiente alta
        expect(screen.getByLabelText("Referencia")).toHaveValue("");
        expect(screen.getByLabelText("Nombre")).toHaveValue("");
    });

    it("cuidados: viajan recortados en el payload de crear (spec color-and-care, R4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.createAdminProduct).mockResolvedValue({ ...producto, id: 99 });

        render(<AdminProductForm />);

        await usuario.type(screen.getByLabelText("Referencia"), "7201/006");
        await usuario.type(screen.getByLabelText("Nombre"), "Abrigo Lana");
        await usuario.type(screen.getByLabelText("Familia"), "OUTERWEAR");
        await usuario.type(screen.getByLabelText("Cuidados"), "  No lavar con lejía  ");

        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        expect(await screen.findByText(/Producto 7201\/006 creado/)).toBeInTheDocument();
        // `trim()` en cliente: lo que llega a la API ya está normalizado (D8)
        expect(api.createAdminProduct).toHaveBeenCalledWith({
            referenceCode: "7201/006",
            name: "Abrigo Lana",
            family: "OUTERWEAR",
            careInstructions: "No lavar con lejía",
        });
    });

    it("cuidados en blanco al editar: se cargan, se borran y el payload va sin ellos (R4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminProduct).mockResolvedValue({ ...producto });

        // GIVEN — un producto que ya tenía cuidados
        render(<AdminProductForm producto={{ ...producto, careInstructions: "Secar a la sombra" }} />);
        expect(screen.getByLabelText("Cuidados")).toHaveValue("Secar a la sombra");

        // WHEN — el operador los deja en blanco para quitarlos
        await usuario.clear(screen.getByLabelText("Cuidados"));
        await usuario.click(screen.getByRole("button", { name: /guardar cambios/i }));

        // THEN — el payload va sin cuidados: el servicio los convierte en NULL
        // y la vitrina deja de pintar la sección (R5)
        expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
        expect(api.updateAdminProduct).toHaveBeenCalledWith(7, {
            name: "Blazer Prueba 72",
            family: "OUTERWEAR",
            description: "Descripción inicial",
        });
    });

    it("un 409 del backend se muestra ya traducido, nunca crudo", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.createAdminProduct).mockRejectedValue(
            new Error(
                'API Error [409]: {"status":409,"error":"Conflict",' +
                    '"code":"CATALOG_CONFLICT",' +
                    '"message":"Ya existe un producto con la referencia 7201/001"}'
            )
        );

        render(<AdminProductForm />);

        await usuario.type(screen.getByLabelText("Referencia"), "7201/001");
        await usuario.type(screen.getByLabelText("Nombre"), "Blazer");
        await usuario.type(screen.getByLabelText("Familia"), "OUTERWEAR");
        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        expect(
            await screen.findByText("Ya existe un producto con la referencia 7201/001")
        ).toBeInTheDocument();
        expect(screen.queryByText(/API Error/)).not.toBeInTheDocument();
    });

    it("modo edición: referencia deshabilitada y PUT sin referenceCode (R2.4)", async () => {
        const usuario = userEvent.setup();
        vi.mocked(api.updateAdminProduct).mockResolvedValue({
            ...producto,
            name: "Blazer Nuevo",
        });
        const onGuardado = vi.fn();

        render(<AdminProductForm producto={producto} onProductoGuardado={onGuardado} />);

        expect(screen.getByLabelText("Referencia")).toBeDisabled();

        await usuario.clear(screen.getByLabelText("Nombre"));
        await usuario.type(screen.getByLabelText("Nombre"), "Blazer Nuevo");
        await usuario.click(screen.getByRole("button", { name: /guardar cambios/i }));

        expect(await screen.findByText("Cambios guardados")).toBeInTheDocument();
        expect(api.updateAdminProduct).toHaveBeenCalledWith(7, {
            name: "Blazer Nuevo",
            family: "OUTERWEAR",
            description: "Descripción inicial",
        });
        expect(onGuardado).toHaveBeenCalledWith({
            ...producto,
            name: "Blazer Nuevo",
        });
    });

    it("las anotaciones de error llevan role=alert para lectores de pantalla", async () => {
        const usuario = userEvent.setup();
        render(<AdminProductForm />);

        await usuario.click(screen.getByRole("button", { name: /crear producto/i }));

        const alertas = screen.getAllByRole("alert");
        expect(alertas.length).toBeGreaterThanOrEqual(3);
    });
});

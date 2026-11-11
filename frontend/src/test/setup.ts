import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";

// Fase 10 — test intermitente medido: con la CPU contendida (3 suites a la vez
// en local; en CI, un runner cargado) los `findBy*`/`waitFor` que esperan a un
// render con datos simulados agotaban el plazo por defecto de Testing Library
// (1 000 ms) y fallaban tests sin ningún defecto real (WishlistPage,
// OrderHistoryPage, AdminStockPage, AdminMetrics, AdminOrdersPage…).
// 5 000 ms es solo el techo: `findBy*` resuelve en cuanto aparece el elemento,
// así que una suite sana no tarda ni un milisegundo más. Queda por debajo del
// `testTimeout` de Vitest (10 s, `vitest.config.ts`), que sigue siendo la red final.
configure({ asyncUtilTimeout: 5000 });

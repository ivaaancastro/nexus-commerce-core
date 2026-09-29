export default function Header() {
    return (
        <header className="border-b border-neutral-200 bg-white sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                <div className="flex items-center space-x-8">
          <span className="text-xl font-semibold tracking-widest uppercase">
            Nexus Core
          </span>
                    <span className="text-xs tracking-wider text-neutral-400 uppercase hidden sm:inline">
            Edition 2026 / Editorial Retail
          </span>
                </div>

                <div className="flex items-center space-x-6 text-xs uppercase tracking-wider text-neutral-600 font-medium">
          <span className="hover:text-black cursor-pointer transition-colors">
            Colección
          </span>
                    <span className="hover:text-black cursor-pointer transition-colors">
            Búsqueda Vectorial
          </span>
                    <div className="h-4 w-px bg-neutral-200" />
                    <span className="text-neutral-400">ES / EUR</span>
                </div>
            </div>
        </header>
    );
}
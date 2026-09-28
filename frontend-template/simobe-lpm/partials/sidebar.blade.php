{{-- simobe-lpm :: sidebar glass collapsible --}}
<aside
    class="flex flex-col fixed left-0 top-0 h-screen w-64 bg-slate-900/95 backdrop-blur-xl border-r border-slate-800/80 transition-all duration-300 z-[55] shadow-2xl lg:!translate-x-0"
    :class="{
        '-translate-x-full': !mobileMenuOpen, 'translate-x-0': mobileMenuOpen,
        'lg:w-64': sidebarOpen, 'lg:w-20': !sidebarOpen
    }"
    x-data="{ groupOpen: true }">

    {{-- Glow line --}}
    <div class="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 via-sky-400 to-orange-500 z-10"></div>

    {{-- Brand --}}
    <div class="p-4 bg-slate-950/60 border-b border-slate-800/80 relative overflow-hidden">
        <div class="absolute inset-0 opacity-5 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:12px_12px]"></div>
        <div class="relative flex items-center space-x-3.5">
            <div class="relative group flex-shrink-0">
                <div class="absolute -inset-0.5 bg-gradient-to-r from-blue-600 to-sky-400 rounded-2xl blur opacity-50 group-hover:opacity-100 transition"></div>
                <div class="w-11 h-11 bg-slate-900 rounded-2xl flex items-center justify-center relative border border-slate-700">
                    <img src="{{ asset('images/logo.png') }}" alt="Logo" class="w-8 h-8 object-contain">
                </div>
            </div>
            <div x-show="sidebarOpen || mobileMenuOpen" x-transition class="min-w-0">
                <div class="flex items-center space-x-1.5">
                    <h1 class="text-lg font-black text-white tracking-tight">{{ config('app.name', 'App') }}</h1>
                    <span class="px-1.5 py-0.5 text-[9px] font-mono font-bold bg-blue-500/20 text-sky-400 rounded border border-blue-400/30">V1.0</span>
                </div>
                <p class="text-xs font-mono text-slate-400 truncate">Panel Admin</p>
            </div>
        </div>
    </div>

    {{-- Nav --}}
    <nav class="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        @php $nav = [
            ['label'=>'Dashboard','icon'=>'M3 12l9-9 9 9M4 10v10h16V10','route'=>'dashboard'],
            ['label'=>'Data','icon'=>'M4 7h16M4 12h16M4 17h10','route'=>'data.index'],
            ['label'=>'Laporan','icon'=>'M9 17v-6h6v6M5 21h14V3H5z','route'=>'laporan.index'],
        ]; @endphp

        @foreach ($nav as $item)
            <a href="{{ Route::has($item['route']) ? route($item['route']) : '#' }}"
               @class([
                   'flex items-center gap-3 px-3 py-2.5 rounded-xl transition group',
                   'bg-gradient-to-r from-blue-600/20 to-sky-500/10 text-sky-300 border border-blue-500/30' => request()->routeIs($item['route']),
                   'text-slate-400 hover:text-white hover:bg-slate-800/60' => !request()->routeIs($item['route']),
               ])>
                <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="{{ $item['icon'] }}"/>
                </svg>
                <span x-show="sidebarOpen || mobileMenuOpen" x-transition class="text-sm font-medium truncate">{{ $item['label'] }}</span>
            </a>
        @endforeach
    </nav>
</aside>

{{-- simobe-lpm :: header fixed glass --}}
@props(['title' => 'Dashboard', 'subtitle' => null])
<header
    class="fixed top-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-gray-200/80 dark:border-slate-800/80 transition-all duration-300 z-30 shadow-md"
    :class="sidebarOpen ? 'left-0 lg:left-64' : 'left-0 lg:left-20'">
    <div class="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-blue-500 via-sky-400 to-orange-500"></div>

    <div class="flex items-center justify-between px-4 lg:px-6 py-3">
        {{-- Kiri: toggle + judul --}}
        <div class="flex items-center space-x-3.5">
            <button @click="sidebarOpen = !sidebarOpen" title="Toggle Sidebar"
                class="hidden lg:flex p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-2xl transition">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <button @click="mobileMenuOpen = !mobileMenuOpen" title="Menu"
                class="lg:hidden p-2.5 text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white rounded-2xl transition">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div class="overflow-hidden">
                <h1 class="text-xl md:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-gray-900 via-gray-800 to-blue-600 dark:from-white dark:via-slate-100 dark:to-sky-200 tracking-tight truncate">{{ $title }}</h1>
                @if($subtitle)<p class="hidden md:block text-xs font-mono text-gray-500 dark:text-slate-400 mt-0.5 truncate">{{ $subtitle }}</p>@endif
            </div>
        </div>

        {{-- Kanan: theme switcher + profil --}}
        <div class="flex items-center space-x-2.5 lg:space-x-4">
            <div class="flex items-center p-1 bg-gray-100 dark:bg-slate-950/80 rounded-2xl border border-gray-200 dark:border-slate-800">
                <template x-for="opt in ['light','dark','system']" :key="opt">
                    <button @click="theme = opt" type="button"
                        class="p-2 rounded-xl text-xs font-medium transition flex items-center justify-center"
                        :class="theme === opt ? 'bg-white dark:bg-slate-800 text-sky-500 shadow' : 'text-gray-400 hover:text-gray-600 dark:hover:text-slate-200'">
                        <span class="font-mono capitalize" x-text="opt.charAt(0).toUpperCase()"></span>
                    </button>
                </template>
            </div>

            <div class="relative" x-data="{ open: false }">
                <button @click="open = !open" class="flex items-center gap-2 p-1.5 pr-3 rounded-2xl hover:bg-gray-100 dark:hover:bg-slate-800 transition">
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-sky-400 flex items-center justify-center text-white font-black">
                        {{ strtoupper(substr(auth()->user()->name ?? 'U', 0, 1)) }}
                    </div>
                    <div class="hidden md:block text-left">
                        <p class="text-sm font-semibold leading-tight">{{ auth()->user()->name ?? 'User' }}</p>
                        <p class="text-[10px] font-mono text-gray-400">{{ auth()->user()->role ?? 'member' }}</p>
                    </div>
                </button>
                <div x-show="open" x-cloak @click.outside="open = false" x-transition
                     class="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-2xl shadow-xl py-2">
                    <a href="#" class="block px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-slate-800">Profil</a>
                    <form method="POST" action="{{ route('logout') }}">@csrf
                        <button class="w-full text-left px-4 py-2 text-sm text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10">Keluar</button>
                    </form>
                </div>
            </div>
        </div>
    </div>
</header>

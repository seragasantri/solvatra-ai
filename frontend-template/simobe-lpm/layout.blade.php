{{-- simobe-lpm :: app shell (layout utama) --}}
<!DOCTYPE html>
<html lang="id"
      x-data="{ theme: $persist('system').as('app-theme') }"
      :class="{ 'dark': theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches) }">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>{{ $title ?? 'Dashboard' }} | {{ config('app.name', 'App') }}</title>
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:300,400,500,600,700,800,900|jetbrains-mono:400,500,700&display=swap" rel="stylesheet" />
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="font-sans antialiased bg-gray-50 dark:bg-slate-950 text-gray-900 dark:text-slate-100 transition-colors duration-300">
    <div class="min-h-screen" x-data="{ sidebarOpen: $persist(true).as('sidebar-open'), mobileMenuOpen: false }">
        {{-- Mobile overlay --}}
        <div x-show="mobileMenuOpen" x-cloak @click="mobileMenuOpen = false" x-transition.opacity
             class="fixed inset-0 bg-gray-600/75 dark:bg-slate-950/80 z-[50] lg:hidden"></div>

        <x-sidebar />
        <x-header :title="$title ?? 'Dashboard'" :subtitle="$subtitle ?? null" />

        <main class="transition-all duration-300 pt-20" :class="sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'">
            <div class="p-4 md:p-6">
                @yield('content')
            </div>
        </main>
    </div>
    @stack('scripts')
</body>
</html>

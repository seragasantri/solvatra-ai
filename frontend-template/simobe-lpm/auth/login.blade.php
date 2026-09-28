{{-- simobe-lpm :: login (mesh gradient + glass card) --}}
<!DOCTYPE html>
<html lang="id" class="h-full">
<head>
    <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>Login | {{ config('app.name', 'App') }}</title>
    <link rel="preconnect" href="https://fonts.bunny.net">
    <link href="https://fonts.bunny.net/css?family=inter:400,600,800,900|jetbrains-mono:400,500,700&display=swap" rel="stylesheet"/>
    @vite(['resources/css/app.css'])
</head>
<body class="h-full font-sans tech-mesh-bg text-slate-100 flex items-center justify-center p-4">
    {{-- orb glow dekoratif --}}
    <div class="absolute w-72 h-72 bg-cyber-blue/30 rounded-full blur-3xl -top-10 -left-10 animate-float"></div>
    <div class="absolute w-72 h-72 bg-cyber-orange/20 rounded-full blur-3xl -bottom-10 -right-10 animate-float-delayed"></div>

    <div class="relative w-full max-w-md glass-card-dark p-8 shadow-2xl">
        <div class="h-1 -mt-8 -mx-8 mb-6 rounded-t-2xl bg-gradient-to-r from-blue-500 via-sky-400 to-orange-500"></div>
        <div class="text-center mb-8">
            <div class="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-sky-400 items-center justify-center mb-4 shadow-lg animate-glow-pulse">
                <img src="{{ asset('images/logo.png') }}" alt="Logo" class="w-10 h-10 object-contain">
            </div>
            <h1 class="text-2xl font-black text-white">{{ config('app.name', 'App') }}</h1>
            <p class="text-xs font-mono text-slate-400 mt-1">Silakan masuk untuk melanjutkan</p>
        </div>

        <form method="POST" action="{{ route('login') }}" class="space-y-5">
            @csrf
            <div>
                <label class="block text-xs font-mono text-slate-400 mb-1.5">EMAIL</label>
                <input name="email" type="email" required autofocus value="{{ old('email') }}"
                    class="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/30 outline-none transition"
                    placeholder="you@example.com">
                @error('email')<p class="text-rose-400 text-xs font-mono mt-1">{{ $message }}</p>@enderror
            </div>
            <div>
                <label class="block text-xs font-mono text-slate-400 mb-1.5">PASSWORD</label>
                <input name="password" type="password" required
                    class="w-full px-4 py-3 rounded-xl bg-slate-950/60 border border-slate-700 text-white placeholder-slate-500 focus:border-sky-400 focus:ring-2 focus:ring-sky-500/30 outline-none transition"
                    placeholder="••••••••">
            </div>
            <label class="flex items-center gap-2 text-sm text-slate-400">
                <input type="checkbox" name="remember" class="rounded bg-slate-950 border-slate-700 text-sky-500"> Ingat saya
            </label>
            <button type="submit" class="btn-primary-tech w-full py-3 text-sm tracking-wide">MASUK</button>
        </form>
    </div>
</body>
</html>

#!/usr/bin/env node
// `solvatra-codex`: jalankan aplikasi asli lewat Solvatra AI (config terpisah, lihat src/apps.js).
import { launchApp } from "../apps.js";
launchApp("codex", process.argv.slice(2)).then((code) => process.exit(code));

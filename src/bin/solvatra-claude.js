#!/usr/bin/env node
// `solvatra-claude`: jalankan aplikasi asli lewat Solvatra AI (config terpisah, lihat src/apps.js).
import { launchApp } from "../apps.js";
launchApp("claude", process.argv.slice(2)).then((code) => process.exit(code));

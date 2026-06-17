#!/usr/bin/env node
/**
 * 杀掉占用指定端口的所有进程（Windows / macOS / Linux 通杀）
 *
 * 用法：
 *   node scripts/kill-port.mjs 3000 5173
 *   npm run dev:clean
 */
import { execSync } from "node:child_process";

const ports = process.argv.slice(2).map(Number).filter(n => Number.isFinite(n) && n > 0);
if (ports.length === 0) {
  console.error("用法: node scripts/kill-port.mjs <port1> [port2] ...");
  process.exit(1);
}

const isWin = process.platform === "win32";

function findPidsOnPort(port) {
  try {
    if (isWin) {
      // netstat -ano | findstr :PORT
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: "utf8" });
      const pids = new Set();
      for (const line of out.split(/\r?\n/)) {
        const m = line.match(/\s(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      return [...pids];
    } else {
      // lsof -ti :PORT
      const out = execSync(`lsof -ti :${port}`, { encoding: "utf8" });
      return out.split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    }
  } catch {
    return [];
  }
}

function killPid(pid) {
  try {
    if (isWin) {
      execSync(`taskkill /F /PID ${pid}`, { stdio: "ignore" });
    } else {
      execSync(`kill -9 ${pid}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

let killed = 0;
for (const port of ports) {
  const pids = findPidsOnPort(port);
  if (pids.length === 0) {
    console.log(`[kill-port] 端口 ${port}: 空闲`);
    continue;
  }
  for (const pid of pids) {
    const ok = killPid(pid);
    if (ok) {
      console.log(`[kill-port] 端口 ${port}: 已杀 PID ${pid}`);
      killed++;
    } else {
      console.log(`[kill-port] 端口 ${port}: 杀 PID ${pid} 失败（可能已退出）`);
    }
  }
}

if (killed > 0) {
  console.log(`[kill-port] 完成，共释放 ${killed} 个进程`);
}

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

interface CheckResult {
  name: string;
  ok: boolean;
  message: string;
}

function check(name: string, ok: boolean, message: string): CheckResult {
  return { name, ok, message };
}

function checkDatabase(): CheckResult {
  const dbPath = path.join(rootDir, 'data', 'chat.db');
  if (!fs.existsSync(dbPath)) {
    return check('Database', false, `数据库文件不存在: ${dbPath}`);
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as Array<{ name: string }>;
    db.close();
    const expectedTables = ['sessions', 'messages', 'dives', 'agent_tasks', 'agent_events', 'evidence_items', 'agent_reports', 'dive_guides', 'agent_run_steps', 'dive_map_nodes', 'dive_map_edges', 'dive_branches', 'provider_profiles', 'app_settings'];
    const missing = expectedTables.filter(t => !tables.some(row => row.name === t));
    if (missing.length > 0) {
      return check('Database', false, `缺少表: ${missing.join(', ')}`);
    }
    return check('Database', true, `数据库正常，共 ${tables.length} 张表`);
  } catch (err: any) {
    return check('Database', false, `数据库连接失败: ${err.message}`);
  }
}

function checkDataDir(): CheckResult {
  const dataDir = path.join(rootDir, 'data');
  if (!fs.existsSync(dataDir)) {
    return check('Data Directory', false, `data 目录不存在: ${dataDir}`);
  }
  try {
    fs.accessSync(dataDir, fs.constants.W_OK);
    return check('Data Directory', true, 'data 目录可写');
  } catch {
    return check('Data Directory', false, 'data 目录不可写');
  }
}

function checkNodeVersion(): CheckResult {
  const version = process.version;
  const major = parseInt(version.slice(1).split('.')[0], 10);
  if (major < 18) {
    return check('Node.js', false, `Node.js 版本过低: ${version}，需要 >= 18`);
  }
  return check('Node.js', true, `Node.js ${version}`);
}

function checkEnvVars(): CheckResult {
  const envPath = path.join(rootDir, '.env');
  const envExamplePath = path.join(rootDir, '.env.example');

  if (!fs.existsSync(envExamplePath)) {
    return check('Environment', false, '.env.example 文件不存在');
  }

  if (!fs.existsSync(envPath)) {
    return check('Environment', true, '.env 文件不存在（可选，使用默认值）');
  }

  const envContent = fs.readFileSync(envPath, 'utf-8');
  const envVars = envContent.split('\n')
    .filter(line => line.trim() && !line.startsWith('#'))
    .map(line => line.split('=')[0].trim());

  return check('Environment', true, `.env 文件存在，包含 ${envVars.length} 个变量`);
}

function checkDependencies(): CheckResult {
  const nodeModulesPath = path.join(rootDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    return check('Dependencies', false, 'node_modules 不存在，请运行 npm install');
  }

  const criticalDeps = ['express', 'better-sqlite3', 'react', 'react-dom'];
  const missing = criticalDeps.filter(dep => {
    const depPath = path.join(nodeModulesPath, dep);
    return !fs.existsSync(depPath);
  });

  if (missing.length > 0) {
    return check('Dependencies', false, `缺少依赖: ${missing.join(', ')}`);
  }

  return check('Dependencies', true, `关键依赖已安装`);
}

function checkProviderProfiles(): CheckResult {
  const dbPath = path.join(rootDir, 'data', 'chat.db');
  if (!fs.existsSync(dbPath)) {
    return check('Provider Profiles', false, '数据库不存在，无法检查 Provider');
  }
  try {
    const db = new Database(dbPath, { readonly: true });
    const profiles = db.prepare('SELECT COUNT(*) as count FROM provider_profiles').get() as { count: number };
    const defaultProfile = db.prepare('SELECT COUNT(*) as count FROM provider_profiles WHERE is_default = 1').get() as { count: number };
    db.close();

    if (profiles.count === 0) {
      return check('Provider Profiles', false, '没有配置 Provider，请在设置页面添加');
    }
    if (defaultProfile.count === 0) {
      return check('Provider Profiles', false, `共 ${profiles.count} 个 Provider，但没有设置默认 Provider`);
    }
    return check('Provider Profiles', true, `共 ${profiles.count} 个 Provider，已设置默认`);
  } catch (err: any) {
    return check('Provider Profiles', false, `检查失败: ${err.message}`);
  }
}

function checkTools(): CheckResult {
  const toolsDir = path.join(rootDir, 'server', 'tools');
  if (!fs.existsSync(toolsDir)) {
    return check('Tools', false, 'server/tools 目录不存在');
  }

  const toolFiles = fs.readdirSync(toolsDir).filter(f => f.endsWith('.ts') && f !== 'registry.ts' && f !== 'toolRouter.ts' && f !== 'index.ts');
  if (toolFiles.length === 0) {
    return check('Tools', false, '没有找到工具适配器文件');
  }

  return check('Tools', true, `找到 ${toolFiles.length} 个工具适配器`);
}

function printResults(results: CheckResult[]): void {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║         快速入坑 - 系统健康检查             ║');
  console.log('╚════════════════════════════════════════════╝\n');

  let hasError = false;

  for (const result of results) {
    const icon = result.ok ? '✓' : '✗';
    const status = result.ok ? 'OK' : 'FAIL';
    console.log(`  ${icon} ${result.name}: ${status}`);
    console.log(`    ${result.message}`);
    if (!result.ok) hasError = true;
  }

  console.log('\n' + '─'.repeat(48));
  if (hasError) {
    console.log('  ⚠  部分检查未通过，请修复后重试');
  } else {
    console.log('  ✓  所有检查通过，系统就绪');
  }
  console.log('');
}

const results: CheckResult[] = [
  checkNodeVersion(),
  checkDataDir(),
  checkDatabase(),
  checkDependencies(),
  checkEnvVars(),
  checkTools(),
  checkProviderProfiles(),
];

printResults(results);

const hasFailures = results.some(r => !r.ok);
process.exit(hasFailures ? 1 : 0);

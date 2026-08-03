import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
function loadLocalEnv(file) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) return;
  for (const line of fs.readFileSync(target, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const name = match[1];
    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[name]) process.env[name] = value;
  }
}
loadLocalEnv('.env.local');

const fail = (message) => {
  console.error(`FAIL: ${message}`);
  process.exitCode = 1;
};
const pass = (message) => console.log(`PASS: ${message}`);
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const exists = (file) => fs.existsSync(path.join(root, file));
const includes = (content, needle, label) => {
  if (!content.includes(needle)) fail(label);
  else pass(label);
};
const notIncludes = (content, needle, label) => {
  if (content.includes(needle)) fail(label);
  else pass(label);
};

const requiredArtifacts = [
  'SPRINT_10R_BRAND_PAYMENT_WALLET_MAPPING_REPORT.md',
  'SPRINT_10R_PAYMENT_MAPPING_CHECKLIST.md',
  'SPRINT_10R_OPERATOR_RUNBOOK.md',
];
for (const file of requiredArtifacts) {
  if (exists(file)) pass(`${file} exists`);
  else fail(`${file} is missing`);
}

const walletStore = read('src/services/circle/wallet-spike-store.server.ts');
const walletService = read('src/services/circle/user-controlled-wallets.server.ts');
const brandPayment = read('src/services/create-challenge/brand-payment-account.server.ts');
const payoutExecution = read('src/services/circle/payout-contract-execution.server.ts');
const mappingMigration = read('supabase/migrations/20260727143000_checkpoint3_lifecycle_persistence.sql');
const internalUtils = read('src/app/api/internal/circle/_utils.ts');
const paymentAccountRoute = read('src/app/api/create-challenge/payment-account/route.ts');
const paymentWalletInitializeRoute = read('src/app/api/create-challenge/payment-wallet/initialize/route.ts');
const createChallengeWizard = read('src/features/create-challenge/components/real-flow/create-challenge-wizard.tsx');
const contract = read('contracts/src/CCNEscrow.sol');
const report = read('SPRINT_10R_BRAND_PAYMENT_WALLET_MAPPING_REPORT.md');
const checklist = read('SPRINT_10R_PAYMENT_MAPPING_CHECKLIST.md');
const runbook = read('SPRINT_10R_OPERATOR_RUNBOOK.md');

includes(walletStore, 'CCN_LIFECYCLE_PERSISTENCE', 'wallet store is tied to lifecycle persistence adapter');
includes(walletStore, 'Production wallet mapping persistence must use Supabase/Postgres', 'production filesystem fallback fails closed');
includes(walletStore, 'ccn_wallet_mappings', 'wallet mappings persist through canonical Supabase table');
includes(walletStore, 'upsertScopedStoredWallet', 'server-side scoped mapping upsert exists');
includes(walletStore, 'buildWalletMappingKey', 'canonical wallet mapping key builder exists');

includes(mappingMigration, 'create table if not exists public.ccn_wallet_mappings', 'wallet mapping table exists in migration');
includes(mappingMigration, "role text not null check (role in ('BRAND', 'CREATOR'))", 'wallet mapping role constraint exists');
includes(mappingMigration, "purpose text not null check (purpose in ('PAYMENT', 'PAYOUT', 'LEGACY'))", 'wallet mapping purpose constraint exists');
includes(mappingMigration, 'unique (ccn_account_id, role, purpose)', 'one mapping per account/role/purpose is enforced');
includes(mappingMigration, 'unique (wallet_id)', 'one Circle wallet cannot be mapped twice');
includes(mappingMigration, "blockchain text not null check (blockchain = 'ARC-TESTNET')", 'Arc Testnet network constraint exists');
includes(mappingMigration, "account_type text not null check (account_type in ('SCA', 'EOA', 'MSCA'))", 'wallet account type constraint exists');

includes(brandPayment, 'getBrandPaymentAccount', 'Brand payment resolver exists');
includes(brandPayment, 'getScopedWallet', 'Brand payment resolver uses scoped wallet lookup');
includes(brandPayment, 'role: "BRAND"', 'Brand payment resolver requires BRAND role');
includes(brandPayment, 'purpose: "PAYMENT"', 'Brand payment resolver requires PAYMENT purpose');
includes(brandPayment, 'expectedBrandWalletAddress', 'Brand payment resolver keeps legacy expected-wallet guard scoped');
includes(brandPayment, 'expectedWalletAddress,', 'Brand payment resolver passes scoped expected-wallet value');
includes(brandPayment, 'ARC_TESTNET_USDC_CONTRACT', 'Brand payment resolver uses official Arc Testnet USDC constant');

includes(walletService, 'initializeScopedUserWallet', 'scoped Hosted Wallet initialization path exists');
includes(walletService, 'idempotencyKey: stableIdempotencyKey("initialize"', 'wallet initialization is idempotent by scope');
includes(walletService, 'fetchCircleWallets', 'Circle wallet discovery path exists');
includes(walletService, 'usableArcScaWallets', 'Circle discovery filters live Arc SCA wallets');

includes(payoutExecution, 'purpose: "PAYOUT"', 'PAYOUT mapping remains scoped to PAYOUT purpose');
includes(payoutExecution, 'Scoped payout wallet mapping does not match server configuration.', 'PAYOUT mapping mismatch fails closed');

includes(internalUtils, 'requireSpikeAccess', 'internal Circle routes require spike access');
includes(internalUtils, 'isSpikeAllowedInEnvironment', 'internal Circle routes are environment-gated');
notIncludes(paymentAccountRoute, 'export async function POST', 'product payment-account route does not expose browser mapping writes');
includes(paymentAccountRoute, 'requireBrandWorkspace', 'payment-account route derives Brand authority server-side');
includes(paymentWalletInitializeRoute, 'initializeScopedUserWallet', 'product Brand payment wallet initialize route uses scoped Hosted Wallet initialization');
includes(paymentWalletInitializeRoute, 'requireBrandWorkspace', 'payment wallet initialize route derives Brand authority server-side');
includes(paymentWalletInitializeRoute, 'role: "BRAND"', 'payment wallet initialize route fixes BRAND role');
includes(paymentWalletInitializeRoute, 'purpose: "PAYMENT"', 'payment wallet initialize route fixes PAYMENT purpose');
includes(createChallengeWizard, '/api/create-challenge/payment-wallet/initialize', 'Create Challenge UI exposes payment wallet onboarding endpoint');
includes(createChallengeWizard, 'Set up payment wallet', 'Create Challenge UI exposes minimum setup action when mapping is missing');

includes(contract, 'contract CCNEscrow', 'CCNEscrow contract source is present');
includes(report, '## 1. Executive Result', 'Sprint 10R report has required structure');
includes(checklist, '## Identity', 'Sprint 10R checklist has Identity section');
includes(runbook, '## 1. Read-Only Discovery', 'Sprint 10R runbook separates read-only discovery');

const artifactText = [report, checklist, runbook].join('\n');
const secretValuePattern = /\b(CIRCLE_API_KEY|SUPABASE_SERVICE_ROLE_KEY|PRIVATE_KEY|ENTITY_SECRET|userToken|encryptionKey|mnemonic|PIN|JWT|cookie)\s*[:=]\s*\S+/i;
if (secretValuePattern.test(artifactText)) fail('Sprint 10R artifacts contain a secret-like assignment');
else pass('Sprint 10R artifacts contain no secret-like assignments');

async function liveReadOnly() {
  if (process.env.CCN_SPRINT10R_READ_ONLY_VERIFY !== 'true') return;
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail('live mode requires Supabase URL and service-role key in environment');
    return;
  }
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '');
  const headers = { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` };
  const query = async (url) => {
    const response = await fetch(`${base}${url}`, { headers });
    const body = await response.json().catch(() => []);
    if (!response.ok) throw new Error(`Supabase read failed with HTTP ${response.status}`);
    return body;
  };
  const [accounts, mappings] = await Promise.all([
    query('/rest/v1/accounts?select=account_id,is_brand,is_creator,status,deleted_at&limit=1000'),
    query('/rest/v1/ccn_wallet_mappings?select=role,purpose,wallet_address,blockchain,account_type,wallet_state&limit=1000'),
  ]);
  const activeBrands = accounts.filter((account) => account.is_brand === true && account.status === 'ACTIVE' && !account.deleted_at);
  const payment = mappings.filter((mapping) => mapping.role === 'BRAND' && mapping.purpose === 'PAYMENT');
  const payout = mappings.filter((mapping) => mapping.purpose === 'PAYOUT');
  console.log(JSON.stringify({ liveReadOnly: true, activeBrands: activeBrands.length, paymentMappings: payment.length, payoutMappings: payout.length }, null, 2));
  if (activeBrands.length !== 1) fail('live mode must find exactly one active Brand account'); else pass('live mode found exactly one active Brand account');
  if (payment.length !== 1) fail('live mode requires exactly one BRAND:PAYMENT mapping before Sprint 10 retry'); else pass('live mode found exactly one BRAND:PAYMENT mapping');
  if (payout.length !== 1) fail('live mode expects the existing single PAYOUT mapping to remain intact'); else pass('live mode found one PAYOUT mapping');
}

await liveReadOnly();

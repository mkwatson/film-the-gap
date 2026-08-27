import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  createProofReceipt,
  parseEmittedPolicy,
  serializeProofReceipt,
  type ProofSource,
} from './proof-receipt.ts';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const proofDirectory = resolve(repositoryRoot, 'proof');
const receiptPath = resolve(repositoryRoot, 'src/generated/hold-policy-receipt.json');
const sourcePaths = [
  'CapabilityPolicy.lean',
  'Main.lean',
  'lakefile.toml',
  'lean-toolchain',
] as const;

interface CommandResult {
  readonly stdout: string;
  readonly stderr: string;
}

function run(command: string, args: readonly string[]): CommandResult {
  const result = spawnSync(command, args, {
    cwd: proofDirectory,
    encoding: 'utf8',
    env: process.env,
  });

  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(' ')} failed with status ${result.status ?? 'unknown'}.`,
        result.stdout,
        result.stderr,
      ]
        .filter((part) => part.length > 0)
        .join('\n'),
    );
  }
  return { stdout: result.stdout, stderr: result.stderr };
}

function proofSources(): readonly ProofSource[] {
  return sourcePaths.map((path) => ({
    path,
    content: readFileSync(resolve(proofDirectory, path), 'utf8'),
  }));
}

function verifyAxiomReport(report: string): void {
  if (report.includes('sorryAx')) {
    throw new Error('Lean axiom report contains sorryAx.');
  }

  const requiredTheorems = [
    'reserveToolAvailable_sound',
    'sellerEnvelope_privateCeiling_noninterference',
    'acceptedHold_sound',
    'staleRevision_refused',
  ] as const;
  for (const theorem of requiredTheorems) {
    if (!report.includes(theorem)) {
      throw new Error(`Lean axiom report omitted ${theorem}.`);
    }
  }
}

export function main(args: readonly string[]): void {
  const mode = args[0] ?? '--check';
  if (mode !== '--check' && mode !== '--write') {
    throw new Error('Usage: proof-receipt-cli.ts [--check|--write]');
  }

  run('lake', ['build']);
  const axiomReport = run('lake', ['env', 'lean', 'CapabilityPolicy.lean']);
  verifyAxiomReport(`${axiomReport.stdout}\n${axiomReport.stderr}`);
  run('lake', ['env', 'leanchecker', '--fresh', 'CapabilityPolicy']);
  const emitted = run('lake', ['exe', 'emit_policy']);
  const receipt = createProofReceipt(parseEmittedPolicy(emitted.stdout.trim()), proofSources());
  const serialized = serializeProofReceipt(receipt);

  if (mode === '--write') {
    mkdirSync(dirname(receiptPath), { recursive: true });
    writeFileSync(receiptPath, serialized, 'utf8');
    process.stdout.write(`Wrote ${receiptPath}\n`);
    return;
  }

  const current = readFileSync(receiptPath, 'utf8');
  if (current !== serialized) {
    throw new Error('The committed Lean receipt is stale. Run pnpm proof:generate.');
  }
  process.stdout.write(`Verified ${receipt.policy} with ${receipt.leanToolchain}.\n`);
}

try {
  main(process.argv.slice(2));
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

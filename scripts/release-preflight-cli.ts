import {
  readReleaseConfig,
  sanitizeReleaseFailure,
  verifyPublicRelease,
} from './release-preflight.ts';

try {
  const report = await verifyPublicRelease(readReleaseConfig(process.env));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} catch (error: unknown) {
  process.stderr.write(
    `${JSON.stringify({ ok: false, error: sanitizeReleaseFailure(error) }, null, 2)}\n`,
  );
  process.exitCode = 1;
}

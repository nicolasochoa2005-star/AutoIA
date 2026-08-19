import * as path from 'path';
import { StageGateService } from './stage-gate.service';

describe('StageGateService', () => {
  const gate = new StageGateService();
  const missing = path.join(__dirname, '__missing_artifact__.json');

  it('throws WAITING_FOR_INPUT when paused without files in non-interactive mode', async () => {
    await expect(
      gate.gate({
        mode: 'pause',
        expectedPaths: [missing],
        slotDir: __dirname,
        interactiveLabel: 'test',
        allowInteractiveWait: false,
        loadExisting: async () => 'loaded',
        generate: async () => 'generated',
      }),
    ).rejects.toThrow(/^WAITING_FOR_INPUT:/);
  });
});

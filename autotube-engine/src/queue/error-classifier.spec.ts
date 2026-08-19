import { classifyErrorReason } from './error-classifier';

describe('classifyErrorReason', () => {
  it('extracts WAITING_FOR_INPUT', () => {
    expect(classifyErrorReason(new Error('WAITING_FOR_INPUT: falta archivo'))).toBe(
      'WAITING_FOR_INPUT',
    );
  });

  it('extracts NO_VISUAL_MATCH', () => {
    expect(classifyErrorReason(new Error('NO_VISUAL_MATCH: sin clips'))).toBe('NO_VISUAL_MATCH');
  });
});

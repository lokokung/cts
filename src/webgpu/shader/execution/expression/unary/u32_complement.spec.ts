export const description = `
Execution Tests for the u32 bitwise complement operation
`;

import { makeTestGroup } from '../../../../../common/framework/test_group.js';
import { GPUTest } from '../../../../gpu_test.js';
import { TypeU32, u32 } from '../../../../util/conversion.js';
import { fullU32Range } from '../../../../util/math.js';
import { allInputSources, run } from '../expression.js';

import { unary } from './unary.js';

export const g = makeTestGroup(GPUTest);

g.test('u32_complement')
  .specURL('https://www.w3.org/TR/WGSL/#bit-expr')
  .desc(
    `
Expression: ~x
`
  )
  .params(u =>
    u.combine('inputSource', allInputSources).combine('vectorize', [undefined, 2, 3, 4] as const)
  )
  .fn(async t => {
    const cases = fullU32Range().map(e => {
      return { input: u32(e), expected: u32(~e) };
    });
    await run(t, unary('~'), [TypeU32], TypeU32, t.params, cases);
  });

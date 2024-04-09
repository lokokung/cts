/**
* AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
**/const builtin = 'distance';export const description = `
Validation tests for the ${builtin}() builtin.
`;
import { makeTestGroup } from '../../../../../../common/framework/test_group.js';
import { keysOf, objectsToRecord } from '../../../../../../common/util/data_tables.js';
import {
  Type,
  kConvertableToFloatScalarsAndVectors,
  scalarTypeOf } from

'../../../../../util/conversion.js';
import { quantizeToF16, quantizeToF32 } from '../../../../../util/math.js';
import { ShaderValidationTest } from '../../../shader_validation_test.js';

import {
  fullRangeForType,
  kConstantAndOverrideStages,
  stageSupportsType,
  validateConstOrOverrideBuiltinEval } from
'./const_override_validation.js';

export const g = makeTestGroup(ShaderValidationTest);

const kValidArgumentTypes = objectsToRecord(kConvertableToFloatScalarsAndVectors);

function quantizeFunctionForScalarType(type) {
  switch (type) {
    case Type.f32:
      return quantizeToF32;
    case Type.f16:
      return quantizeToF16;
    default:
      return (v) => v;
  }
}

g.test('values').
desc(
  `
Validates that constant evaluation and override evaluation of ${builtin}() never errors
`
).
params((u) =>
u.
combine('stage', kConstantAndOverrideStages).
combine('type', keysOf(kValidArgumentTypes)).
filter((u) => stageSupportsType(u.stage, kValidArgumentTypes[u.type])).
beginSubcases().
expand('a', (u) => fullRangeForType(kValidArgumentTypes[u.type], 5)).
expand('b', (u) => fullRangeForType(kValidArgumentTypes[u.type], 5))
).
beforeAllSubcases((t) => {
  if (scalarTypeOf(kValidArgumentTypes[t.params.type]) === Type.f16) {
    t.selectDeviceOrSkipTestCase('shader-f16');
  }
}).
fn((t) => {
  let expectedResult = true;

  const scalarType = scalarTypeOf(kValidArgumentTypes[t.params.type]);
  const quantizeFn = quantizeFunctionForScalarType(scalarType);

  // Distance equation: length(a - b)
  // Should be invalid if the calculations result in intermediate values that
  // exceed the maximum representable float value for the given type.
  const a = Number(t.params.a);
  const b = Number(t.params.b);
  const ab = quantizeFn(a - b);

  if (!Number.isFinite(ab)) {
    expectedResult = false;
  }

  // Only calculates the full length if the type is a vector. Otherwise abs(a-b) is used.
  if (kValidArgumentTypes[t.params.type].width > 1) {
    const ab2 = quantizeFn(ab * ab);
    const sqrLen = quantizeFn(ab2 * kValidArgumentTypes[t.params.type].width);
    // Square root does not need to be calculated because it can never fail if
    // the previous results are finite.

    if (!Number.isFinite(ab2) || !Number.isFinite(sqrLen)) {
      expectedResult = false;
    }
  }

  const type = kValidArgumentTypes[t.params.type];

  // Validates distance(vecN(a), vecN(b)) or distance(a, b);
  validateConstOrOverrideBuiltinEval(
    t,
    builtin,
    expectedResult,
    [type.create(t.params.a), type.create(t.params.b)],
    t.params.stage
  );
});

const kArgCases = {
  good: '(vec3(0), vec3(1))',
  bad_no_parens: '',
  // Bad number of args
  bad_0args: '()',
  bad_1arg: '(vec3(0))',
  bad_3arg: '(vec3(0), vec3(1), vec3(2))',
  // Bad value for arg 0
  bad_0bool: '(false, vec3(1))',
  bad_0array: '(array(1.1,2.2), vec3(1))',
  bad_0struct: '(modf(2.2), vec3(1))',
  bad_0int: '(0i, vec3(1))',
  bad_0vec2i: '(vec2i(), vec3(1))',
  bad_0vec3i: '(vec3i(), vec3(1))',
  bad_0vec4i: '(vec4i(), vec3(1))',
  bad_0uint: '(0u, vec3(1))',
  bad_0vec2u: '(vec2u(), vec3(1))',
  bad_0vec3u: '(vec3u(), vec3(1))',
  bad_0vec4u: '(vec4u(), vec3(1))',
  // Bad value type for arg 1
  bad_1bool: '(vec3(0), true)',
  bad_1array: '(vec3(0), array(1.1,2.2))',
  bad_1struct: '(vec3(0), modf(2.2))',
  bad_1int: '(vec3(0), 0i)',
  bad_1vec2i: '(vec3(0), vec2i())',
  bad_1vec3i: '(vec3(0), vec3i())',
  bad_1vec4i: '(vec3(0), vec4i())',
  bad_1uint: '(vec3(0), 0u)',
  bad_1vec2u: '(vec3(0), vec2u())',
  bad_1vec3u: '(vec3(0), vec3u())',
  bad_1vec4u: '(vec3(0), vec4u())'
};

g.test('args').
desc(`Test compilation failure of ${builtin} with variously shaped and typed arguments`).
params((u) => u.combine('arg', keysOf(kArgCases))).
fn((t) => {
  t.expectCompileResult(
    t.params.arg === 'good',
    `const c = ${builtin}${kArgCases[t.params.arg]};`
  );
});

g.test('must_use').
desc(`Result of ${builtin} must be used`).
params((u) => u.combine('use', [true, false])).
fn((t) => {
  const use_it = t.params.use ? '_ = ' : '';
  t.expectCompileResult(t.params.use, `fn f() { ${use_it}${builtin}${kArgCases['good']}; }`);
});
// Implements the wpt-embedded test runner (see also: wpt/cts.html).

import { DefaultTestFileLoader } from '../internal/file_loader.js';
import { prettyPrintLog } from '../internal/logging/log_message.js';
import { Logger } from '../internal/logging/logger.js';
import { parseQuery } from '../internal/query/parseQuery.js';
import { parseExpectationsForTestQuery, relativeQueryString } from '../internal/query/query.js';
import { assert } from '../util/util.js';

import { optionEnabled } from './helper/options.js';
import { TestWorker } from './helper/test_worker.js';

// testharness.js API (https://web-platform-tests.org/writing-tests/testharness-api.html)
declare interface WptTestObject {
  step(f: () => void): void;
  done(): void;
}
declare function setup(properties: { explicit_done?: boolean }): void;
declare function promise_test(f: (t: WptTestObject) => Promise<void>, name: string): void;
declare function done(): void;
declare function assert_unreached(description: string): void;

declare const loadWebGPUExpectations: Promise<unknown> | undefined;
declare const shouldWebGPUCTSFailOnWarnings: Promise<boolean> | undefined;

setup({
  // It's convenient for us to asynchronously add tests to the page. Prevent done() from being
  // called implicitly when the page is finished loading.
  explicit_done: true,
});

(async () => {
  const workerEnabled = optionEnabled('worker');
  const worker = workerEnabled ? new TestWorker(false) : undefined;

  const failOnWarnings =
    typeof shouldWebGPUCTSFailOnWarnings !== 'undefined' && (await shouldWebGPUCTSFailOnWarnings);

  const loader = new DefaultTestFileLoader();
  const qs = new URLSearchParams(window.location.search).getAll('q');
  assert(qs.length === 1, 'currently, there must be exactly one ?q=');
  const filterQuery = parseQuery(qs[0]);
  const testcases = await loader.loadCases(filterQuery);

  const expectations =
    typeof loadWebGPUExpectations !== 'undefined'
      ? parseExpectationsForTestQuery(
          await loadWebGPUExpectations,
          filterQuery,
          new URL(window.location.href)
        )
      : [];

  const log = new Logger();

  for (const testcase of testcases) {
    const name = testcase.query.toString();
    // For brevity, display the case name "relative" to the ?q= path.
    const shortName = relativeQueryString(filterQuery, testcase.query) || '(case)';

    const wpt_fn = async () => {
      const [rec, res] = log.record(name);
      if (worker) {
        await worker.run(rec, name, expectations);
      } else {
        await testcase.run(rec, expectations);
      }

      // Unfortunately, it seems not possible to surface any logs for warn/skip.
      if (res.status === 'fail' || (res.status === 'warn' && failOnWarnings)) {
        const logs = (res.logs ?? []).map(prettyPrintLog);
        assert_unreached('\n' + logs.join('\n') + '\n');
      }
    };

    promise_test(wpt_fn, shortName);
  }

  done();
})();

import { createWatcher } from '../src';
import { calls } from './shared';

const config = {
	preset: "nile"
};
const testAccount = "0x41228c75e7ec8d4a17ba10dd98c3f78a5918348df9";
// const testAccount = "0x1234567890123456789012345678901234567890";
const testCalls = [{
	call: ['getEthBalance(address)(uint256)', testAccount],
	returns: [['ETH_BALANCE', val => val / 10 ** 18]]
}];

describe('watcher', () => {
	// beforeEach(() => fetch.resetMocks());

	test('schemas set correctly', async () => {
		const watcher = createWatcher(testCalls[0], config);
		expect(watcher.schemas).toEqual([testCalls[0]]);
	});

	test('await initial fetch', async () => {
		const watcher = createWatcher(testCalls[0], config);

		watcher.subscribe(update => {
			console.debug("update =", update);
		});
		
		watcher.batch().subscribe(updates => {
			console.debug("updates =", updates);
		});

		watcher.onNewBlock(number => {
			console.debug("number =", number);
			// results['BLOCK_NUMBER'] = number;
		});
		watcher.start();

		// console.debug(results['BLOCK_NUMBER']);
		// await watcher.initialFetch;
		// console.debug(results['BLOCK_NUMBER']);
	});
});
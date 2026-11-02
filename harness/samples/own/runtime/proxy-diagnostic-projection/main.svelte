<script>
	import { find, optional, contains, search, take, fill, box as edgeBox, put } from './operations.svelte.js';
	import Child from './Child.svelte';
	let box = $state({ items: null });
	const raw = {};
	let array = $state([raw]);
	let result = $state('');
	let changing = $state({ source: null, target: 'untouched' });
	const keyTrace = [];
	const changingKey = {
		[Symbol.toPrimitive](hint) {
			const selected = keyTrace.length === 0 ? 'source' : 'target';
			keyTrace.push([hint, this === changingKey, selected]);
			return selected;
		}
	};
	const counts = { receiver: 0, key: 0, coercion: 0, rhs: 0, from: 0 };
	const order = [];
	const assignmentOrder = [];
	const property = { [Symbol.toPrimitive]() { counts.coercion++; assignmentOrder.push('coercion'); return 'items'; } };
	function receiver() { counts.receiver++; assignmentOrder.push('receiver'); return box; }
	function key() { counts.key++; assignmentOrder.push('key'); return property; }
	function rhs() { counts.rhs++; assignmentOrder.push('rhs'); return []; }
	const custom = {
		get includes() {
			order.push('method');
			return function (item) { order.push('call'); return this === custom && item === 'x'; };
		}
	};
	function customReceiver() { order.push('receiver'); return custom; }
	function argument() { order.push('argument'); return 'x'; }
	export async function edges() {
		let argumentsCalled = 0;
		const optionalResult = optional(null, () => argumentsCalled++);
		let target = $state({ items: null });
		const iterator = take(target);
		const yielded = iterator.next();
		const resumed = iterator.next([7]);
		resumed.value.push(8);
		let waiting = $state({ items: null });
		let waits = 0;
		const pending = async () => { waits++; return []; };
		const waited = await fill(waiting, pending);
		waited.push(2);
		const skipped = await fill(waiting, pending);
		const foreign = Proxy.revocable({}, {});
		foreign.revoke();
		const found = contains(foreign.proxy);
		const failure = new Error('search failure');
		const failing = new Proxy([1], { get(target, key, receiver) {
			if (key === '0') throw failure;
			return Reflect.get(target, key, receiver);
		} });
		let sameError = false;
		try { search(failing, 2); } catch (error) { sameError = error === failure; }
		const assigned = await put();
		assigned.push(1);
		return { optionalResult, argumentsCalled, yielded, resumed, target,
			found, sameError, stored: [...edgeBox.items], assigned,
			waiting: [...waiting.items], waited, waits, skipped: skipped === waiting.items };
	}
	function run() {
		const assigned = (receiver()[key()] ??= rhs());
		assigned.push(1);
		const customResult = customReceiver().includes(argument());
		const from = { [Symbol.toPrimitive]() { counts.from++; return 0; } };
		const index = array.indexOf(raw, from);
		const last = find(array, raw);
		const found = array.includes(array[0]);
		const absent = [].includes(raw);
		const chosen = (changing[changingKey] ??= []);
		chosen.push(9);
		result = JSON.stringify({ items: box.items, customResult, index, last, found, absent, counts, order, assignmentOrder, changing, chosen, keyTrace });
	}
</script>
<button onclick={run}>run</button>
<p>{result}</p>
<Child value={box} />

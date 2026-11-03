<script>
	import {
		Debounced,
		ElementSize,
		onClickOutside,
		PersistedState,
		PressedKeys,
		Previous,
		watch
	} from 'runed';

	let text = $state('');
	const debounced = new Debounced(() => text, 400);

	let count = $state(0);
	const previous = new Previous(() => count);
	let changes = $state([]);
	watch(
		() => count,
		(now, before) => {
			changes = [...changes.slice(-2), `${before ?? '–'} → ${now}`];
		}
	);

	const visits = new PersistedState('vigla-playground-visits', 0);
	visits.current++;

	let box = $state();
	const size = new ElementSize(() => box);

	let outside = $state(0);
	onClickOutside(
		() => box,
		() => outside++
	);

	const keys = new PressedKeys();
	const held = $derived(keys.all.join(' + ') || 'none');
</script>

<p>
	<input bind:value={text} placeholder="type" />
	<span class="muted">Debounced: {debounced.current || '…'}</span>
</p>

<p>
	<button onclick={() => count++}>count {count}</button>
	<span class="muted">Previous: {previous.current ?? '–'} · watch: {changes.join(', ') || 'no changes'}</span>
</p>

<p class="muted">PersistedState: this page was opened {visits.current} times (reload to see it grow).</p>

<div class="box" bind:this={box}>
	ElementSize {Math.round(size.width)}×{Math.round(size.height)} · clicks outside: {outside}
</div>

<p class="muted">PressedKeys: {held}</p>

<style>
	.box {
		resize: both;
		overflow: auto;
		border: 1px dashed #9aa1b4;
		border-radius: 8px;
		padding: 10px;
		width: 280px;
		min-height: 40px;
	}
</style>

<script>
	import { fork } from 'svelte';
	import Forked from './Forked.svelte';

	let a = $state(0);
	let x = $state(0);
	let f;
	let releaseA = () => {};
	let releaseX = () => {};

	function gateA(value) {
		if (!value) return value;
		return new Promise((resolve) => (releaseA = () => resolve(value)));
	}

	function gateX(value) {
		if (!value) return value;
		return new Promise((resolve) => (releaseX = () => resolve(value)));
	}
</script>

<button onclick={() => a++}>a</button>
<button onclick={() => (f = fork(() => x++))}>fork</button>
<button
	onclick={() => {
		releaseA();
		releaseX();
	}}>release</button
>
<button onclick={() => f.commit()}>commit</button>
<p>{await gateA(a)}</p>
{#if (await gateX(x)) > 0}
	<Forked />
{/if}

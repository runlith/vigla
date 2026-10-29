<script>
	import ComponentA from './ComponentA.svelte';
	import ComponentB from './ComponentB.svelte';

	let type = $state(ComponentA);
	let elem = $state.raw();
	const Type = $derived(type);

	$effect(() => {
		console.log(elem);
	});
</script>

<button
	onclick={() => {
		type = ComponentA;
	}}>a</button
>
<button
	onclick={() => {
		type = ComponentB;
	}}>b</button
>

<Type bind:this={elem}>Content</Type>

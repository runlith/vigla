<script>
	let arr = [];
	let Comp = $state(undefined);
</script>

<!-- svelte-ignore binding_property_non_reactive -->
<Comp bind:this={arr[0]} />

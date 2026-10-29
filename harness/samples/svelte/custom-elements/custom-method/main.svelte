<svelte:options customElement="custom-element" />

<script>
	export function updateFoo(value) {
		foo = value;
	}

	let { foo } = $props();
</script>

<p>{foo}</p>

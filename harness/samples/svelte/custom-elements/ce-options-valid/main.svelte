<svelte:options
	customElement={{
		tag: "custom-element",
		props: {
			name: { reflect: false, type: "String", attribute: "name" },
		},
	}}
/>

<script>
	let { name } = $props();
</script>

<h1>Hello {name}!</h1>

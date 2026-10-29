<svelte:options
	customElement={{
		tag: "custom-element",
		props: {
			camelCase: { attribute: "camel-case" },
			camelCase2: { reflect: true },
			anArray: { attribute: "an-array", type: "Array", reflect: true },
		},
	}}
/>

<script>
	let { camelCase, camelCase2, anArray } = $props();
</script>

<h1>{camelCase2} {camelCase}!</h1>
{#each anArray as item}
	<p>{item}</p>
{/each}

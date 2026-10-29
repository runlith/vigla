<svelte:options
	customElement={{
		tag: "my-widget",
		props: { red: { reflect: true } },
	}}
/>

<script>
	let { red = false } = $props();
</script>

<div>hi</div>
<p>hi</p>

<style>
	:host([red]) div {
		color: red;
	}
	:host([white]) p {
		color: white;
	}
</style>

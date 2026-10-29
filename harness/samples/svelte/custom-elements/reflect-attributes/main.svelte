<svelte:options
	customElement={{
		tag: 'custom-element',
		props: { red: { reflect: true, type: 'Boolean' } }
	}}
/>

<script>
	import './my-widget.svelte';
	let { red } = $props();
</script>

<div>hi</div>
<p>hi</p>
<button onclick={() => (red = false)}>off</button>
<my-widget {red} white></my-widget>

<style>
	:host([red]) div {
		color: red;
	}
	:host([white]) p {
		color: white;
	}
</style>

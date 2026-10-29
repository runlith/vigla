<script>
	import Component from './component.svelte';
	import { mount, onMount } from 'svelte';

	let div;
	const props = $state({ foo: 'foo', baz: 'baz' });

	onMount(() => {
		mount(Component, { target: div, props });
	});
</script>

<button
	onclick={() => {
		props.foo = 'foo';
		props.bar = 'bar';
		props.baz = 'baz';
		props.buz = 'buz';
	}}>reset</button
> {props.foo} {props.bar} {props.baz} {props.buz}
<div bind:this={div}></div>

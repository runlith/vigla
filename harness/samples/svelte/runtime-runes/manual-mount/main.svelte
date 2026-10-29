<script>
	import { mount, unmount } from 'svelte';
	import Inner from './inner.svelte';

	let el;
	let component;
	let props = $state({count: 0, onupdate: (count) => props.count = count});

	function toggle() {
		if (component) {
			unmount(component);
			component = null;
		} else {
			component = mount(Inner, { target: el, props, context: new Map([['multiply', 2]]) });
		}
	}
</script>

<button onclick={toggle}>toggle</button>
<div bind:this={el}></div>

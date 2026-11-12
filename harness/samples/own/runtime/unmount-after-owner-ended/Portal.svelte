<script>
	import { mount, unmount } from 'svelte';
	import Child from './Child.svelte';

	$effect(() => {
		const instance = mount(Child, { target: document.body });
		return () => unmount(instance);
	});
</script>

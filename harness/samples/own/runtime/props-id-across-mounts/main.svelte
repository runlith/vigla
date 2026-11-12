<script>
	import { mount, unmount } from 'svelte';
	import Field from './Field.svelte';
	let ids = $state([]);
	function twice(node) {
		const first = mount(Field, { target: node, props: { report: (id) => ids.push(id) } });
		const second = mount(Field, { target: node, props: { report: (id) => ids.push(id) } });
		unmount(first);
		const third = mount(Field, { target: node, props: { report: (id) => ids.push(id) } });
		return () => {
			unmount(second);
			unmount(third);
		};
	}
</script>

<div {@attach twice}></div>
<p>{new Set(ids).size} of {ids.length}</p>

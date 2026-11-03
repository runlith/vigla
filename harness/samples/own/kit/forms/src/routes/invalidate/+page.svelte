<script>
	import { invalidateAll } from '$app/navigation';
	import { page } from '$app/state';
	import { enhance } from '$app/forms';
	let { data, form } = $props();
</script>

<form method="POST" use:enhance>
	<button id="add">add</button>
</form>
<button id="reload" onclick={() => invalidateAll()}>reload</button>
<p id="loads">{data.loads}</p>
<p id="prop">{JSON.stringify(form)}</p>
<p id="page">{JSON.stringify(page.form)}</p>

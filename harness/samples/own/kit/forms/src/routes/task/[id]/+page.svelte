<script>
	import { taskInfo } from './task.remote';
	let { data } = $props();
</script>

<form {...taskInfo}>
	<input id="title" {...taskInfo.fields.title.as('text', data.task.title)} />
</form>
<p id="data">{data.task.title}</p>
<a id="list" href="/task">list</a>

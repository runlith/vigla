<script>
	import { enhance } from '$app/forms';
	let { form } = $props();
</script>

<form
	method="POST"
	use:enhance={(input) => {
		const data = new FormData();
		data.append('greeting', 'Hello World');
		input.formData = data;
	}}
>
	<button>go</button>
</form>
<p id="form">{JSON.stringify(form)}</p>

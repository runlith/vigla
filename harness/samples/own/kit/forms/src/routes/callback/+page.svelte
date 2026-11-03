<script>
	import { seen } from './seen.remote';
	let log = $state('');

	const submitting = seen.enhance(async ({ submit }) => {
		const value = seen.fields.value();
		log = JSON.stringify({ intent: value.intent, ids: value.ids });
		await submit();
	});
</script>

<form {...submitting}>
	<input {...seen.fields.ids.as('checkbox', 'a')} />
	<input {...seen.fields.ids.as('checkbox', 'b')} />
	<button id="plain" {...seen.fields.intent.as('submit', 'plain')}>plain</button>
	<button id="set" type="button" onclick={() => seen.fields.ids.set(['a'])}>set</button>
	<button id="chosen" {...seen.fields.intent.as('submit', 'chosen')}>chosen</button>
</form>
<p id="log">{log}</p>

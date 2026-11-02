<script>
	import { getContext, setContext } from 'vigla';

	let { name, gate } = $props();
	setContext('page', name);
	const first = await gate;
	let looped = '';
	async function* words(page) {
		yield { word: page };
		yield { word: getContext('page') };
		yield {};
	}
	const parts = { [Symbol.asyncIterator]: () => words(getContext('page')) };
	outer: inner: for await (const { word = getContext('page') } of parts) {
		looped += word + (await gate);
		if (looped) continue outer;
	}
</script>

<p>{name}:{first}{looped}{(await gate) + (await gate)}</p>

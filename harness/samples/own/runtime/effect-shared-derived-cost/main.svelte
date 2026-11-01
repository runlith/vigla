<script>
	import { flushSync } from 'svelte';

	export function run(depth, fromEffect) {
		let source = $state(0);
		let trigger = $state(0);
		let seen = 0;
		const stop = $effect.root(() => {
			let level = () => source;
			for (let i = 0; i < depth; i++) {
				const below = level;
				const left = $derived(below() + 1);
				const right = $derived(below() + 2);
				const both = $derived(left + right);
				level = () => both;
			}
			const top = level;
			$effect(() => { seen = top(); });
			$effect(() => {
				trigger;
				if (fromEffect) source = trigger;
			});
		});
		try {
			flushSync();
			if (fromEffect) trigger = 1;
			else source = 1;
			flushSync();
			return seen;
		} finally {
			stop();
		}
	}
</script>

<script>
	import { getContext } from "svelte";

    let { count, onupdate } = $props();
    const multiply = getContext('multiply');
</script>

<button onclick={() => onupdate(count + 1 * multiply)}>{count}</button>

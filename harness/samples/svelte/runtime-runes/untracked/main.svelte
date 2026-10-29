<script>
  import { untrack } from 'svelte';
  let count = $state(0);
  let multiplier = $state(1);
  let result = $derived(count * untrack(() => multiplier));
</script>

<button onclick={() => multiplier++}>multiplier: {multiplier}</button>
<button onclick={() => count++}>result: {result}</button>

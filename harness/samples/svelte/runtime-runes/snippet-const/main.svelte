<script>
  let count = $state(0);
</script>

{#snippet counter()}
  {@const doubled = count * 2}
  <button onclick={() => (count += 1)}>{doubled}</button>
{/snippet}

{@render counter()}

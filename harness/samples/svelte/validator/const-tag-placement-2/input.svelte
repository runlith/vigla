<script>
  let { a } = $props();
</script>

{#each a as i}
  <div>
    {@const b = i}
  </div>
{/each}
<script>
  import Component from './component.svelte'
  let { children } = $props();
</script>

<label>
  {@render children?.()}
</label>

<label>
  <Component />
</label>

const elements = Array.from(
	{ length: 1000 },
	(_, i) =>
		`<!-- item ${i} --><section data-index="${i}" class="card card-${i}" title="plain text ${i}"><h2>Item ${i} has a reasonably long entity-free text value</h2><input disabled value="prefix {value} suffix"><textarea>plain {value} text</textarea></section>`
).join('\n');

const scriptStyle = `<script>
	// line comment
	/* block comment */
	const value = 42;
</script>

<style>
${Array.from(
	{ length: 1000 },
	(_, i) => `.item-${i} { /* property ${i} */ color: red; margin-inline: ${i}px; }`
).join('\n')}
</style>`;

const typescript = `${Array.from(
	{ length: 1000 },
	(_, i) => `<div data-index="${i}">Item ${i}</div>`
).join('\n')}
{value as number}
<script lang="ts">
	let value: number = 42;
</script>${' \n'.repeat(1000)}`;

export const sources = [
	{ name: 'elements', source: elements, iterations: 5 },
	{ name: 'script_style', source: scriptStyle, iterations: 50 },
	{ name: 'typescript', source: typescript, iterations: 25 }
];

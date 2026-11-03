export async function load({ parent, params }) {
	const { version } = await parent();
	return { seen: version, slug: params.slug };
}

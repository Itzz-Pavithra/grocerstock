import adapterAuto from '@sveltejs/adapter-auto';
import adapterVercel from '@sveltejs/adapter-vercel';

// Use adapter-vercel on Vercel deployment (Linux environment).
// On Windows local development, fallback to adapter-auto to avoid Windows symlink EPERM restrictions.
const useVercelAdapter = Boolean(process.env.VERCEL || process.env.CI) || process.platform !== 'win32';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		runes: ({ filename }) =>
			filename.split(/[/\\]/).includes('node_modules') ? undefined : true
	},
	kit: {
		adapter: useVercelAdapter ? adapterVercel() : adapterAuto()
	}
};

export default config;

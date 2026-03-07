/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {
			fontFamily: {
				display: ['Fraunces', 'Georgia', 'serif'],
				body:    ['DM Sans', 'system-ui', 'sans-serif'],
				mono:    ['DM Mono', 'monospace'],
			},
			animation: {
				'drift-a':     'driftA 20s ease-in-out infinite alternate',
				'drift-b':     'driftB 25s ease-in-out infinite alternate',
				'drift-c':     'driftC 30s ease-in-out infinite alternate',
				'scroll-pulse':'scrollPulse 2.2s ease-in-out infinite',
			},
			keyframes: {
				driftA:      { to: { transform: 'translate(8%,14%)' } },
				driftB:      { to: { transform: 'translate(-12%,-8%)' } },
				driftC:      { to: { transform: 'translate(-14%,18%)' } },
				scrollPulse: {
					'0%,100%': { opacity: '0.35', transform: 'scaleY(0.75)', transformOrigin: 'top' },
					'55%':     { opacity: '1',    transform: 'scaleY(1)' },
				}
			}
		},
	},
	plugins: [],
}
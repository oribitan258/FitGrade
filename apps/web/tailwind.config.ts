import type { Config } from 'tailwindcss';
import tailwindcssAnimate from 'tailwindcss-animate';

const config: Config = {
  // shadcn/ui requires class-based dark mode toggling
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
  	container: {
  		center: true,
  		padding: '2rem',
  		screens: {
  			'2xl': '1400px'
  		}
  	},
  	extend: {
  		colors: {
  			border: 'hsl(var(--border))',
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			background: 'hsl(var(--background))',
  			foreground: 'hsl(var(--foreground))',
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			grade: {
  				excellent: '#15803d',
  				'very-good': '#0d9488',
  				good: '#6d28d9',
  				pass: '#d97706',
  				fail: '#dc2626'
  			},
  			fg: {
  				violet: '#6D28D9',
  				'violet-soft': '#8B5CF6',
  				green: '#16A34A',
  				lime: '#84CC16',
  				amber: '#F59E0B',
  				red: '#EF4444',
  				canvas: '#F2F4F8',
  				arena: '#0F0A2E'
  			},
  			sidebar: {
  				DEFAULT: 'hsl(var(--sidebar-background))',
  				foreground: 'hsl(var(--sidebar-foreground))',
  				primary: 'hsl(var(--sidebar-primary))',
  				'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
  				accent: 'hsl(var(--sidebar-accent))',
  				'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
  				border: 'hsl(var(--sidebar-border))',
  				ring: 'hsl(var(--sidebar-ring))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)',
  			'2xl': '1rem',
  			'3xl': '1.5rem',
  			'4xl': '2rem'
  		},
  		fontFamily: {
  			sans: [
  				'Segoe UI',
  				'Arial',
  				'system-ui',
  				'-apple-system',
  				'sans-serif'
  			],
  			mono: [
  				'ui-monospace',
  				'SFMono-Regular',
  				'Menlo',
  				'Consolas',
  				'monospace'
  			]
  		},
  		fontSize: {
  			'display-xl': [
  				'clamp(3rem, 13vw, 5.5rem)',
  				{
  					lineHeight: '1',
  					fontWeight: '900'
  				}
  			],
  			'display-lg': [
  				'clamp(2.5rem, 10vw, 4.5rem)',
  				{
  					lineHeight: '1',
  					fontWeight: '900'
  				}
  			],
  			'display-md': [
  				'clamp(2rem, 6vw, 3rem)',
  				{
  					lineHeight: '1.05',
  					fontWeight: '900'
  				}
  			]
  		},
  		boxShadow: {
  			'card-hero': '0 4px 24px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.04)',
  			'card-standard': '0 2px 8px rgba(0,0,0,0.05)',
  			lift: '0 8px 24px rgba(0,0,0,0.10)',
  			'lift-lg': '0 12px 40px rgba(0,0,0,0.14)',
  			'glow-violet': '0 0 0 1px rgba(139,92,246,0.5), 0 0 20px rgba(139,92,246,0.15)',
  			'glow-green': '0 0 0 1px rgba(132,204,22,0.4), 0 0 20px rgba(132,204,22,0.2)',
  			'glow-amber': '0 0 0 2px rgba(245,158,11,0.6), 0 0 24px rgba(245,158,11,0.25)',
  			'glow-red': '0 0 0 2px rgba(239,68,68,0.6), 0 0 24px rgba(239,68,68,0.20)',
  			cta: '0 8px 32px rgba(109,40,217,0.35)'
  		},
  		keyframes: {
  			'accordion-down': {
  				from: { height: '0' },
  				to: { height: 'var(--radix-accordion-content-height)' }
  			},
  			'accordion-up': {
  				from: { height: 'var(--radix-accordion-content-height)' },
  				to: { height: '0' }
  			},
  			shimmer: {
  				'0%': { backgroundPosition: '-400px 0' },
  				'100%': { backgroundPosition: '400px 0' }
  			},
  			// Magic UI — Border Beam
  			'border-beam': {
  				'100%': { 'offset-distance': '100%' }
  			},
  			// Magic UI — Shine Border
  			'shine-spin': {
  				'0%': { transform: 'rotate(0deg)' },
  				'100%': { transform: 'rotate(360deg)' }
  			},
  			// Aceternity — Meteors
  			meteor: {
  				'0%': { transform: 'rotate(215deg) translateX(0)', opacity: '1' },
  				'70%': { opacity: '1' },
  				'100%': {
  					transform: 'rotate(215deg) translateX(-500px)',
  					opacity: '0'
  				}
  			},
  			// Sidebar logo shimmer — ping-pong so 0%/100% share the same keyframe,
  			// guaranteeing a seamless infinite loop with zero boundary jump.
  			// Light peak sweeps right→left→right with ease-in-out for a premium feel.
  			'logo-shimmer': {
  				'0%, 100%': { backgroundPosition: '0% center' },
  				'50%':       { backgroundPosition: '100% center' },
  			},
  		},
  		animation: {
  			'accordion-down': 'accordion-down 0.2s ease-out',
  			'accordion-up': 'accordion-up 0.2s ease-out',
  			shimmer: 'shimmer 1.5s linear infinite',
  			'border-beam': 'border-beam calc(var(--duration)*1s) infinite linear',
  			'shine-spin': 'shine-spin var(--duration, 14s) linear infinite',
  			meteor: 'meteor var(--duration, 5s) var(--delay, 0s) linear infinite',
  			'logo-shimmer': 'logo-shimmer 5s ease-in-out infinite',
  		},
  		backgroundImage: {
  			'gradient-brand': 'linear-gradient(135deg, #6D28D9 0%, #A855F7 50%, #C084FC 100%)',
  			'gradient-sport': 'linear-gradient(135deg, #16A34A 0%, #84CC16 100%)',
  			'gradient-countdown': 'linear-gradient(90deg, #22c55e 0%, #eab308 100%)',
  			'gradient-shimmer': 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%)'
  		}
  	}
  },
  // tailwindcss-animate is required by shadcn/ui components.
  // Imported at top of file (ESM) — `require()` here breaks under Node's
  // ESM resolution when next.config.mjs is treated as an ES module.
  plugins: [tailwindcssAnimate],
};

export default config;
